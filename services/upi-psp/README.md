# UPI PSP (Payment Service Provider) Mobile App

## 🏦 Overview

The **UPI PSP Mobile App** is a cross-platform Flutter application that provides a complete UPI payment experience. It serves as the user-facing interface for the UPI ecosystem, enabling users to send money, receive payments, manage bank accounts, and perform various financial transactions securely.

## 🎯 Features

### 🔐 Security & Authentication
- **Biometric Authentication** (Fingerprint, Face ID)
- **Device Binding** with secure device fingerprinting
- **Root/Jailbreak Detection** for enhanced security
- **Screen Recording Protection** to prevent data leaks
- **Secure PIN Management** with encryption
- **App Integrity Checks** to prevent tampering

### 💰 Payment Features
- **Send Money** via VPA, mobile number, or QR code
- **Request Money** with customizable payment requests
- **QR Code Generation** for receiving payments
- **QR Code Scanning** for quick payments
- **Transaction History** with detailed records
- **Recurring Payments** and scheduled transfers
- **Split Bills** among multiple users

### 🏪 Merchant Features
- **Merchant QR Codes** for business payments
- **Payment Collection** with invoice generation
- **Business Analytics** and transaction reports
- **Bulk Payment Processing** for vendors

### 📱 User Experience
- **Intuitive UI/UX** following Material Design principles
- **Dark/Light Theme** support
- **Multi-language Support** (Hindi, English)
- **Offline Transaction Queue** for poor connectivity
- **Push Notifications** for transaction updates
- **Voice Commands** for accessibility

## 🛠 Tech Stack

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| **Framework** | Flutter | 3.16+ | Cross-platform mobile development |
| **Language** | Dart | 3.2+ | Application logic and UI |
| **State Management** | BLoC Pattern | 8.1+ | Predictable state management |
| **Networking** | gRPC + Dio | Latest | Backend communication |
| **Security** | Flutter Secure Storage | 9.0+ | Encrypted local storage |
| **Authentication** | Local Auth | 2.1+ | Biometric authentication |
| **QR Codes** | QR Flutter/Scanner | Latest | QR code generation and scanning |
| **Database** | Hive/SQLite | Latest | Local data persistence |
| **Testing** | Flutter Test + Mockito | Latest | Unit and widget testing |

## 🏗 Architecture

The app follows **Clean Architecture** principles with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│  │    BLoC     │ │   Widgets   │ │        Pages           │ │
│  │ (Business   │ │    (UI)     │ │    (Screens)           │ │
│  │   Logic)    │ │             │ │                        │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Domain Layer                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│  │  Use Cases  │ │  Entities   │ │    Repositories         │ │
│  │ (Business   │ │ (Models)    │ │   (Interfaces)          │ │
│  │    Rules)   │ │             │ │                        │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│  │ Repositories│ │ Data Sources│ │       Models            │ │
│  │(Concrete)   │ │(Remote/Local│ │    (DTOs)              │ │
│  │             │ │             │ │                        │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Flutter SDK 3.16+
- Dart SDK 3.2+
- Android Studio / VS Code
- Android SDK (for Android development)
- Xcode (for iOS development)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd services/upi-psp
   ```

2. **Install dependencies**
   ```bash
   flutter pub get
   ```

3. **Generate code (if needed)**
   ```bash
   flutter packages pub run build_runner build
   ```

4. **Run the app**
   ```bash
   # Development
   flutter run --debug
   
   # Production
   flutter run --release
   ```

### Environment Setup

Create environment configuration files:

```bash
# lib/core/config/dev_config.dart
class DevConfig {
  static const String apiBaseUrl = 'https://dev-api.upi.com';
  static const String grpcEndpoint = 'dev-grpc.upi.com:50051';
  static const bool enableLogging = true;
}

# lib/core/config/prod_config.dart
class ProdConfig {
  static const String apiBaseUrl = 'https://api.upi.com';
  static const String grpcEndpoint = 'grpc.upi.com:50051';
  static const bool enableLogging = false;
}
```

## 📱 App Structure

```
lib/
├── core/                           # Core utilities and constants
│   ├── config/                     # Environment configurations
│   ├── constants/                  # App constants and enums
│   ├── errors/                     # Error handling
│   ├── network/                    # Network clients and interceptors
│   ├── security/                   # Security utilities
│   ├── themes/                     # App themes and styling
│   └── utils/                      # Helper utilities
├── data/                           # Data layer
│   ├── datasources/               # Remote and local data sources
│   │   ├── remote/                # API clients
│   │   └── local/                 # Local storage
│   ├── models/                    # Data models (DTOs)
│   └── repositories/              # Repository implementations
├── domain/                        # Domain layer
│   ├── entities/                  # Business entities
│   ├── repositories/              # Repository interfaces
│   └── usecases/                  # Business use cases
├── presentation/                  # Presentation layer
│   ├── bloc/                      # BLoC state management
│   ├── pages/                     # Screen widgets
│   ├── widgets/                   # Reusable UI components
│   └── routes/                    # Navigation routing
├── injection/                     # Dependency injection
├── l10n/                         # Localization files
└── main.dart                     # App entry point
```

## 🔐 Security Features

### Device Security
```dart
class DeviceSecurityService {
  // Root/Jailbreak detection
  Future<bool> isDeviceSecure();
  
  // Screen recording protection
  Future<void> enableScreenProtection();
  
  // Device fingerprinting
  Future<String> getDeviceFingerprint();
  
  // App integrity verification
  Future<bool> verifyAppIntegrity();
}
```

### Secure Storage
```dart
class SecureStorageService {
  // Encrypted PIN storage
  Future<void> storeUserPin(String hashedPin);
  
  // Device binding token
  Future<void> storeDeviceToken(String token);
  
  // Biometric preferences
  Future<void> storeBiometricPreference(bool enabled);
}
```

### Transaction Security
```dart
class TransactionSecurityService {
  // Transaction signing
  Future<String> signTransaction(Transaction transaction, String pin);
  
  // PIN validation
  Future<bool> validatePin(String enteredPin, String storedHash);
  
  // Transaction encryption
  Future<String> encryptTransactionData(Map<String, dynamic> data);
}
```

## 💳 Payment Flows

### Send Money Flow
1. **Recipient Selection** (VPA, Mobile, QR)
2. **Amount Entry** with validation
3. **Transaction Review** with fees
4. **Authentication** (PIN/Biometric)
5. **Processing** with real-time status
6. **Confirmation** with receipt

### Request Money Flow
1. **Request Creation** with amount and note
2. **Recipient Selection** from contacts
3. **Request Sending** via notification
4. **Status Tracking** until payment
5. **Receipt Generation** on completion

### QR Payment Flow
1. **QR Code Scanning** with camera
2. **Payment Details Parsing**
3. **Amount Confirmation**
4. **Authentication** and processing
5. **Success Confirmation**

## 🧪 Testing

### Unit Tests
```bash
# Run all unit tests
flutter test

# Run specific test file
flutter test test/domain/usecases/process_payment_test.dart

# Run with coverage
flutter test --coverage
```

### Widget Tests
```bash
# Test UI components
flutter test test/presentation/widgets/

# Test specific widget
flutter test test/presentation/widgets/transaction_card_test.dart
```

### Integration Tests
```bash
# Run integration tests
flutter drive --target=test_driver/app.dart
```

### Test Coverage
```bash
# Generate coverage report
genhtml coverage/lcov.info -o coverage/html
open coverage/html/index.html
```

## 📊 Performance Monitoring

### Key Metrics
- **App Launch Time**: < 3 seconds cold start
- **Transaction Processing**: < 2 seconds end-to-end
- **Memory Usage**: < 150MB average
- **Battery Consumption**: Optimized for all-day usage
- **Crash Rate**: < 0.1% sessions

### Monitoring Tools
- **Firebase Crashlytics** for crash reporting
- **Firebase Performance** for app performance
- **Custom Analytics** for business metrics
- **APM Integration** for transaction monitoring

## 🌐 Localization

The app supports multiple languages:

```yaml
# pubspec.yaml
flutter:
  generate: true

# l10n.yaml
arb-dir: lib/l10n
template-arb-file: app_en.arb
output-localization-file: app_localizations.dart
```

Supported languages:
- English (en)
- Hindi (hi)
- Tamil (ta)
- Telugu (te)
- Bengali (bn)

## 🔧 Build & Deployment

### Android Build
```bash
# Debug build
flutter build apk --debug

# Release build
flutter build apk --release

# App Bundle for Play Store
flutter build appbundle --release
```

### iOS Build
```bash
# Debug build
flutter build ios --debug

# Release build
flutter build ios --release

# Archive for App Store
flutter build ipa --release
```

### Build Configuration

```yaml
# android/app/build.gradle
android {
    signingConfigs {
        release {
            storeFile file('../../../keystore/upi-psp-release.jks')
            storePassword System.getenv("KEYSTORE_PASSWORD")
            keyAlias System.getenv("KEY_ALIAS")
            keyPassword System.getenv("KEY_PASSWORD")
        }
    }
    
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

## 🚀 CI/CD Pipeline

### GitHub Actions Workflow
```yaml
name: UPI PSP App CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: subosito/flutter-action@v2
      - run: flutter pub get
      - run: flutter analyze
      - run: flutter test --coverage
      
  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: subosito/flutter-action@v2
      - run: flutter build apk --release
      - uses: actions/upload-artifact@v3
        with:
          name: release-apk
          path: build/app/outputs/apk/release/
```

## 📚 Documentation

- **API Documentation**: [API Docs](docs/api.md)
- **Architecture Guide**: [Architecture](docs/architecture.md)
- **Security Guide**: [Security](docs/security.md)
- **Testing Guide**: [Testing](docs/testing.md)
- **Deployment Guide**: [Deployment](docs/deployment.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Follow the coding standards and write tests
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

### Code Standards
- Follow [Effective Dart](https://dart.dev/guides/language/effective-dart) guidelines
- Use meaningful variable and function names
- Write comprehensive tests for new features
- Document public APIs with dartdoc comments
- Run `flutter analyze` before committing

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

For support and questions:
- **Email**: support@upi-psp.com
- **Documentation**: [docs.upi-psp.com](https://docs.upi-psp.com)
- **Issues**: [GitHub Issues](https://github.com/your-org/upi-psp/issues)

---

**Built with ❤️ using Flutter**
