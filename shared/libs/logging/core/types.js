"use strict";
/**
 * Core Types for Suuupra Global Logger
 * Shared interfaces and types across all language implementations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogLevel = void 0;
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["TRACE"] = 0] = "TRACE";
    LogLevel[LogLevel["DEBUG"] = 10] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 20] = "INFO";
    LogLevel[LogLevel["WARN"] = 30] = "WARN";
    LogLevel[LogLevel["ERROR"] = 40] = "ERROR";
    LogLevel[LogLevel["FATAL"] = 50] = "FATAL";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
