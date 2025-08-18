#!/usr/bin/env python3
"""
Automated Monitoring System for Suuupra EdTech Super-Platform
Continuously monitors all 17 microservices with health checks, metrics collection, and alerting
"""

import asyncio
import aiohttp
import json
import time
import logging
import smtplib
from datetime import datetime, timedelta
from email.mime.text import MimeText
from email.mime.multipart import MimeMultipart
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
import sqlite3
import os
import sys

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/monitoring.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class ServiceConfig:
    name: str
    port: int
    health_endpoint: str = "/health"
    timeout: int = 10
    critical: bool = True
    expected_status: int = 200

@dataclass
class TestResult:
    service: str
    timestamp: datetime
    status: str  # "healthy", "unhealthy", "timeout", "error"
    response_time: float
    status_code: Optional[int] = None
    error_message: Optional[str] = None

class ServiceMonitor:
    """Monitors individual service health and performance"""
    
    def __init__(self, config: ServiceConfig):
        self.config = config
        self.history: List[TestResult] = []
        self.consecutive_failures = 0
        self.last_alert_time: Optional[datetime] = None
        
    async def check_health(self, session: aiohttp.ClientSession) -> TestResult:
        """Perform health check for the service"""
        start_time = time.time()
        timestamp = datetime.now()
        
        try:
            url = f"http://localhost:{self.config.port}{self.config.health_endpoint}"
            timeout = aiohttp.ClientTimeout(total=self.config.timeout)
            
            async with session.get(url, timeout=timeout) as response:
                response_time = time.time() - start_time
                
                if response.status == self.config.expected_status:
                    result = TestResult(
                        service=self.config.name,
                        timestamp=timestamp,
                        status="healthy",
                        response_time=response_time,
                        status_code=response.status
                    )
                    self.consecutive_failures = 0
                else:
                    result = TestResult(
                        service=self.config.name,
                        timestamp=timestamp,
                        status="unhealthy",
                        response_time=response_time,
                        status_code=response.status,
                        error_message=f"Unexpected status code: {response.status}"
                    )
                    self.consecutive_failures += 1
                    
        except asyncio.TimeoutError:
            response_time = time.time() - start_time
            result = TestResult(
                service=self.config.name,
                timestamp=timestamp,
                status="timeout",
                response_time=response_time,
                error_message="Request timeout"
            )
            self.consecutive_failures += 1
            
        except Exception as e:
            response_time = time.time() - start_time
            result = TestResult(
                service=self.config.name,
                timestamp=timestamp,
                status="error",
                response_time=response_time,
                error_message=str(e)
            )
            self.consecutive_failures += 1
        
        # Keep only last 100 results
        self.history.append(result)
        if len(self.history) > 100:
            self.history.pop(0)
            
        return result
    
    def should_alert(self) -> bool:
        """Determine if an alert should be sent"""
        if self.consecutive_failures < 3:
            return False
            
        if self.last_alert_time is None:
            return True
            
        # Don't spam alerts - wait at least 5 minutes between alerts
        return datetime.now() - self.last_alert_time > timedelta(minutes=5)
    
    def get_uptime_percentage(self, hours: int = 24) -> float:
        """Calculate uptime percentage for the last N hours"""
        cutoff_time = datetime.now() - timedelta(hours=hours)
        recent_results = [r for r in self.history if r.timestamp > cutoff_time]
        
        if not recent_results:
            return 100.0
            
        healthy_count = sum(1 for r in recent_results if r.status == "healthy")
        return (healthy_count / len(recent_results)) * 100.0
    
    def get_average_response_time(self, hours: int = 1) -> float:
        """Calculate average response time for the last N hours"""
        cutoff_time = datetime.now() - timedelta(hours=hours)
        recent_results = [r for r in self.history if r.timestamp > cutoff_time and r.status == "healthy"]
        
        if not recent_results:
            return 0.0
            
        return sum(r.response_time for r in recent_results) / len(recent_results)

class PlatformMonitor:
    """Main monitoring system for the entire platform"""
    
    def __init__(self):
        self.services = self._initialize_services()
        self.monitors = {service.name: ServiceMonitor(service) for service in self.services}
        self.db_path = "logs/monitoring.db"
        self._setup_database()
        
    def _initialize_services(self) -> List[ServiceConfig]:
        """Initialize service configurations"""
        return [
            # Phase 1: Foundation
            ServiceConfig("API Gateway", 8080, "/actuator/health"),
            ServiceConfig("Identity Service", 8081, "/actuator/health"),
            ServiceConfig("Content Service", 8082, "/health"),
            
            # Phase 2: Payments
            ServiceConfig("Commerce Service", 8083, "/health"),
            ServiceConfig("Payments Service", 8084, "/health"),
            ServiceConfig("Ledger Service", 8085, "/health"),
            ServiceConfig("UPI Core", 3001, "/health"),
            ServiceConfig("Bank Simulator", 3000, "/health"),
            
            # Phase 3: Media
            ServiceConfig("Live Classes", 8086, "/health"),
            ServiceConfig("VOD Service", 8087, "/health"),
            ServiceConfig("Mass Live", 8088, "/health"),
            ServiceConfig("Creator Studio", 8089, "/health"),
            
            # Phase 4: Intelligence
            ServiceConfig("Search Crawler", 8090, "/health"),
            ServiceConfig("Recommendations", 8091, "/health"),
            ServiceConfig("LLM Tutor", 8000, "/health"),
            ServiceConfig("Analytics", 8092, "/health"),
            
            # Phase 5: Supporting
            ServiceConfig("Counters Service", 8093, "/health"),
            ServiceConfig("Live Tracking", 8094, "/health"),
            ServiceConfig("Notifications", 8095, "/health"),
            ServiceConfig("Admin Dashboard", 3002, "/", expected_status=200, critical=False),
            
            # Infrastructure
            ServiceConfig("Prometheus", 9090, "/-/ready", critical=False),
            ServiceConfig("Grafana", 3000, "/api/health", critical=False),
            ServiceConfig("Elasticsearch", 9200, "/_cluster/health", critical=False),
        ]
    
    def _setup_database(self):
        """Setup SQLite database for storing monitoring data"""
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS health_checks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                service TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                status TEXT NOT NULL,
                response_time REAL NOT NULL,
                status_code INTEGER,
                error_message TEXT
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                service TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                alert_type TEXT NOT NULL,
                message TEXT NOT NULL,
                resolved BOOLEAN DEFAULT FALSE
            )
        ''')
        
        conn.commit()
        conn.close()
    
    def _store_result(self, result: TestResult):
        """Store test result in database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO health_checks 
            (service, timestamp, status, response_time, status_code, error_message)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            result.service,
            result.timestamp.isoformat(),
            result.status,
            result.response_time,
            result.status_code,
            result.error_message
        ))
        
        conn.commit()
        conn.close()
    
    def _store_alert(self, service: str, alert_type: str, message: str):
        """Store alert in database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO alerts (service, timestamp, alert_type, message)
            VALUES (?, ?, ?, ?)
        ''', (service, datetime.now().isoformat(), alert_type, message))
        
        conn.commit()
        conn.close()
    
    async def check_all_services(self) -> List[TestResult]:
        """Check health of all services"""
        results = []
        
        async with aiohttp.ClientSession() as session:
            tasks = []
            for monitor in self.monitors.values():
                task = monitor.check_health(session)
                tasks.append(task)
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Filter out exceptions and store results
            valid_results = []
            for result in results:
                if isinstance(result, TestResult):
                    valid_results.append(result)
                    self._store_result(result)
                    
                    # Check if alert should be sent
                    monitor = self.monitors[result.service]
                    if result.status != "healthy" and monitor.should_alert():
                        await self._send_alert(result)
                        monitor.last_alert_time = datetime.now()
                else:
                    logger.error(f"Exception during health check: {result}")
            
            return valid_results
    
    async def _send_alert(self, result: TestResult):
        """Send alert for unhealthy service"""
        alert_message = f"""
        🚨 ALERT: Service {result.service} is unhealthy!
        
        Status: {result.status}
        Timestamp: {result.timestamp}
        Response Time: {result.response_time:.2f}s
        Status Code: {result.status_code}
        Error: {result.error_message}
        
        Consecutive Failures: {self.monitors[result.service].consecutive_failures}
        """
        
        logger.error(alert_message)
        self._store_alert(result.service, "unhealthy", alert_message)
        
        # Here you could integrate with external alerting systems:
        # - Send email
        # - Send Slack notification  
        # - Send SMS
        # - Create PagerDuty incident
        # - etc.
    
    def generate_status_report(self) -> Dict:
        """Generate comprehensive status report"""
        report = {
            "timestamp": datetime.now().isoformat(),
            "overall_status": "healthy",
            "services": {},
            "summary": {
                "total_services": len(self.monitors),
                "healthy_services": 0,
                "unhealthy_services": 0,
                "critical_services_down": 0
            }
        }
        
        for service_name, monitor in self.monitors.items():
            if monitor.history:
                latest_result = monitor.history[-1]
                uptime_24h = monitor.get_uptime_percentage(24)
                avg_response_time = monitor.get_average_response_time(1)
                
                service_status = {
                    "status": latest_result.status,
                    "last_check": latest_result.timestamp.isoformat(),
                    "response_time": latest_result.response_time,
                    "uptime_24h": uptime_24h,
                    "avg_response_time_1h": avg_response_time,
                    "consecutive_failures": monitor.consecutive_failures,
                    "critical": monitor.config.critical
                }
                
                report["services"][service_name] = service_status
                
                if latest_result.status == "healthy":
                    report["summary"]["healthy_services"] += 1
                else:
                    report["summary"]["unhealthy_services"] += 1
                    if monitor.config.critical:
                        report["summary"]["critical_services_down"] += 1
                        report["overall_status"] = "degraded"
            else:
                report["services"][service_name] = {
                    "status": "unknown",
                    "critical": monitor.config.critical
                }
        
        if report["summary"]["critical_services_down"] > 0:
            report["overall_status"] = "critical"
        elif report["summary"]["unhealthy_services"] > 0:
            report["overall_status"] = "degraded"
        
        return report
    
    async def run_continuous_monitoring(self, interval: int = 60):
        """Run continuous monitoring with specified interval"""
        logger.info(f"Starting continuous monitoring (interval: {interval}s)")
        
        while True:
            try:
                start_time = time.time()
                results = await self.check_all_services()
                check_duration = time.time() - start_time
                
                # Log summary
                healthy_count = sum(1 for r in results if r.status == "healthy")
                total_count = len(results)
                
                logger.info(f"Health check completed: {healthy_count}/{total_count} services healthy (took {check_duration:.2f}s)")
                
                # Generate and save status report every 10 minutes
                if int(time.time()) % 600 < interval:
                    report = self.generate_status_report()
                    with open("logs/status_report.json", "w") as f:
                        json.dump(report, f, indent=2, default=str)
                
                await asyncio.sleep(interval)
                
            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                await asyncio.sleep(interval)
    
    def get_service_metrics(self, service_name: str, hours: int = 24) -> Dict:
        """Get detailed metrics for a specific service"""
        if service_name not in self.monitors:
            return {"error": "Service not found"}
        
        monitor = self.monitors[service_name]
        cutoff_time = datetime.now() - timedelta(hours=hours)
        recent_results = [r for r in monitor.history if r.timestamp > cutoff_time]
        
        if not recent_results:
            return {"error": "No recent data available"}
        
        healthy_results = [r for r in recent_results if r.status == "healthy"]
        
        metrics = {
            "service": service_name,
            "time_period_hours": hours,
            "total_checks": len(recent_results),
            "healthy_checks": len(healthy_results),
            "uptime_percentage": (len(healthy_results) / len(recent_results)) * 100,
            "average_response_time": sum(r.response_time for r in healthy_results) / len(healthy_results) if healthy_results else 0,
            "min_response_time": min(r.response_time for r in healthy_results) if healthy_results else 0,
            "max_response_time": max(r.response_time for r in healthy_results) if healthy_results else 0,
            "consecutive_failures": monitor.consecutive_failures,
            "last_check": recent_results[-1].timestamp.isoformat(),
            "last_status": recent_results[-1].status
        }
        
        return metrics

async def main():
    """Main function to run the monitoring system"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Suuupra Platform Monitoring System")
    parser.add_argument("--interval", type=int, default=60, help="Monitoring interval in seconds")
    parser.add_argument("--once", action="store_true", help="Run health checks once and exit")
    parser.add_argument("--report", action="store_true", help="Generate status report and exit")
    parser.add_argument("--service", type=str, help="Get metrics for specific service")
    
    args = parser.parse_args()
    
    monitor = PlatformMonitor()
    
    if args.once:
        logger.info("Running one-time health check...")
        results = await monitor.check_all_services()
        
        print(f"\n🏥 Health Check Results ({len(results)} services)")
        print("=" * 50)
        
        for result in sorted(results, key=lambda x: x.service):
            status_emoji = "✅" if result.status == "healthy" else "❌"
            print(f"{status_emoji} {result.service:<20} {result.status:<10} {result.response_time:.3f}s")
        
        healthy_count = sum(1 for r in results if r.status == "healthy")
        print(f"\n📊 Summary: {healthy_count}/{len(results)} services healthy")
        
    elif args.report:
        logger.info("Generating status report...")
        report = monitor.generate_status_report()
        print(json.dumps(report, indent=2, default=str))
        
    elif args.service:
        logger.info(f"Getting metrics for service: {args.service}")
        metrics = monitor.get_service_metrics(args.service)
        print(json.dumps(metrics, indent=2, default=str))
        
    else:
        await monitor.run_continuous_monitoring(args.interval)

if __name__ == "__main__":
    asyncio.run(main())
