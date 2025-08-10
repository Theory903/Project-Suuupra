# UPI PSP Service - Comprehensive TODO

## 1. 🎯 Overview & Learning Objectives

The **UPI PSP (Payment Service Provider) Service** is the user-facing component of the UPI clone. It provides the mobile application that users interact with to send and receive money. This service is a great opportunity to learn about building a secure, user-friendly, and feature-rich mobile application.

### **Why this stack?**

*   **Flutter**: A cross-platform UI toolkit that allows us to build a beautiful and performant mobile application for both Android and iOS from a single codebase.
*   **gRPC**: For its high-performance, low-latency, and strongly-typed communication with the UPI Core service.
*   **Secure Storage**: For securely storing user data, such as UPI PINs and transaction history, on the device.

### **Learning Focus**:

*   **Mobile Application Development**: Learn how to build a cross-platform mobile application with Flutter.
*   **Secure Coding**: Implement security best practices for a financial application, such as secure storage, device binding, and root detection.
*   **User Experience (UX)**: Design and implement a user-friendly and intuitive user interface for a payment application.
*   **gRPC Integration**: Learn how to integrate a mobile application with a gRPC backend.

---

## 2. 🚀 Implementation Plan (4 Weeks)

### **Week 1: Foundation & User Onboarding**

*   **Goal**: Set up the basic infrastructure and implement the user onboarding flow.

*   **Tasks**:
    *   [ ] **Project Setup**: Initialize a Flutter project and set up the necessary dependencies.
    *   [ ] **User Onboarding**: Implement the user registration and login flow.
    *   [ ] **Bank Account Linking**: Implement the flow for linking a user's bank account to their VPA.
    *   [ ] **UPI PIN Setup**: Implement the flow for setting up a UPI PIN.

### **Week 2: P2P Payments**

*   **Goal**: Implement the core peer-to-peer (P2P) payment functionality.

*   **Tasks**:
    *   [ ] **Send Money**: Implement the UI and logic for sending money to another VPA.
    *   [ ] **Request Money**: Implement the UI and logic for requesting money from another VPA.
    *   [ ] **Transaction History**: Implement the UI for displaying the user's transaction history.

### **Week 3: P2M Payments & QR Codes**

*   **Goal**: Implement peer-to-merchant (P2M) payments and QR code functionality.

*   **Tasks**:
    *   [ ] **QR Code Generation**: Implement the logic for generating a QR code for a user's VPA.
    *   [ ] **QR Code Scanning**: Implement the logic for scanning a QR code to initiate a payment.
    *   [ ] **Merchant Payments**: Implement the UI and logic for making payments to merchants.

### **Week 4: Security, Testing & Deployment**

*   **Goal**: Add security features, write comprehensive tests, and prepare for deployment.

*   **Tasks**:
    *   [ ] **Security Features**: Implement security features such as device binding, root detection, and app integrity checks.
    *   [ ] **Testing**: Write unit, widget, and integration tests to ensure the reliability of the application.
    *   [ ] **Deployment**: Prepare the application for deployment to the Google Play Store and Apple App Store.

---

## 3. 🔌 API Design (gRPC)

The PSP service will primarily be a client of the UPI Core service. It will use the gRPC API defined in the UPI Core's `TODO.md` to process transactions and get transaction status.

### **Enhanced API Integration**

```dart
// gRPC client integration
class UpiCoreClient {
  late ClientChannel channel;
  late UpiCoreClient stub;
  
  Future<void> initialize() async {
    channel = ClientChannel(
      'upi-core-service',
      port: 50051,
      options: const ChannelOptions(
        credentials: ChannelCredentials.secure(),
      ),
    );
    stub = UpiCoreClient(channel);
  }
  
  Future<TransactionResponse> processPayment({
    required String payerVpa,
    required String payeeVpa,
    required double amount,
    required String pin,
  }) async {
    final request = TransactionRequest()
      ..transactionId = generateTransactionId()
      ..payerVpa = payerVpa
      ..payeeVpa = payeeVpa
      ..amount = amount
      ..signature = await signTransaction(request, pin);
    
    return await stub.processTransaction(request);
  }
}
```

---

## 4. 📱 Enhanced Mobile App Architecture

### **4.1. App Structure**

```
lib/
├── core/
│   ├── constants/
│   ├── errors/
│   ├── network/
│   ├── security/
│   └── utils/
├── data/
│   ├── datasources/
│   ├── models/
│   └── repositories/
├── domain/
│   ├── entities/
│   ├── repositories/
│   └── usecases/
├── presentation/
│   ├── bloc/
│   ├── pages/
│   ├── widgets/
│   └── themes/
└── main.dart
```

### **4.2. Key Features Implementation**

#### **Secure Authentication**
```dart
class BiometricAuthService {
  final LocalAuthentication _localAuth = LocalAuthentication();
  
  Future<bool> authenticateUser() async {
    try {
      final bool isAvailable = await _localAuth.isDeviceSupported();
      if (!isAvailable) return false;
      
      return await _localAuth.authenticate(
        localizedReason: 'Please authenticate to access your UPI account',
        options: const AuthenticationOptions(
          biometricOnly: true,
          stickyAuth: true,
        ),
      );
    } catch (e) {
      return false;
    }
  }
}
```

#### **QR Code Generation & Scanning**
```dart
class QRService {
  Future<String> generatePaymentQR({
    required String vpa,
    required double amount,
    String? merchantName,
  }) async {
    final qrData = {
      'pa': vpa,
      'pn': merchantName ?? '',
      'am': amount.toString(),
      'cu': 'INR',
      'tn': 'UPI Payment',
    };
    
    return 'upi://pay?${Uri(queryParameters: qrData).query}';
  }
  
  Future<Map<String, String>?> scanQR() async {
    final result = await BarcodeScanner.scan();
    if (result.type == ResultType.Barcode) {
      return parseUpiQR(result.rawContent);
    }
    return null;
  }
}
```

#### **Transaction Management**
```dart
class TransactionBloc extends Bloc<TransactionEvent, TransactionState> {
  final ProcessPaymentUseCase processPayment;
  final GetTransactionHistoryUseCase getHistory;
  
  TransactionBloc({
    required this.processPayment,
    required this.getHistory,
  }) : super(TransactionInitial()) {
    on<ProcessPaymentEvent>(_onProcessPayment);
    on<GetHistoryEvent>(_onGetHistory);
  }
  
  Future<void> _onProcessPayment(
    ProcessPaymentEvent event,
    Emitter<TransactionState> emit,
  ) async {
    emit(TransactionLoading());
    
    try {
      final result = await processPayment(PaymentParams(
        payerVpa: event.payerVpa,
        payeeVpa: event.payeeVpa,
        amount: event.amount,
        pin: event.pin,
      ));
      
      result.fold(
        (failure) => emit(TransactionFailure(failure.message)),
        (transaction) => emit(TransactionSuccess(transaction)),
      );
    } catch (e) {
      emit(TransactionFailure(e.toString()));
    }
  }
}
```

---

## 5. 🔒 Security Implementation

### **5.1. Device Security**
```dart
class DeviceSecurityService {
  Future<bool> isDeviceSecure() async {
    // Root/Jailbreak detection
    bool isRooted = await FlutterJailbreakDetection.jailbroken;
    if (isRooted) return false;
    
    // Debug mode detection
    bool isInDebugMode = kDebugMode;
    if (isInDebugMode) return false;
    
    // Screen recording detection
    bool isScreenRecording = await ScreenProtector.isRecording();
    if (isScreenRecording) return false;
    
    return true;
  }
  
  Future<void> enableScreenProtection() async {
    await ScreenProtector.protectDataLeakageOn();
    await ScreenProtector.preventScreenshotOn();
  }
}
```

### **5.2. Secure Storage**
```dart
class SecureStorageService {
  final FlutterSecureStorage _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(
      encryptedSharedPreferences: true,
      keyCipherAlgorithm: KeyCipherAlgorithm.RSA_ECB_OAEPwithSHA_256andMGF1Padding,
      storageCipherAlgorithm: StorageCipherAlgorithm.AES_GCM_NoPadding,
    ),
    iOptions: IOSOptions(
      accessibility: IOSAccessibility.first_unlock_this_device,
    ),
  );
  
  Future<void> storeUserPin(String hashedPin) async {
    await _storage.write(key: 'user_pin_hash', value: hashedPin);
  }
  
  Future<String?> getUserPin() async {
    return await _storage.read(key: 'user_pin_hash');
  }
  
  Future<void> storeDeviceId(String deviceId) async {
    await _storage.write(key: 'device_id', value: deviceId);
  }
}
```

### **5.3. PIN Management**
```dart
class PinService {
  Future<String> hashPin(String pin, String salt) async {
    final bytes = utf8.encode(pin + salt);
    final digest = sha256.convert(bytes);
    return digest.toString();
  }
  
  Future<bool> validatePin(String enteredPin, String storedHash, String salt) async {
    final hashedEntered = await hashPin(enteredPin, salt);
    return hashedEntered == storedHash;
  }
  
  Future<String> generateSalt() async {
    final random = Random.secure();
    final values = List<int>.generate(32, (i) => random.nextInt(256));
    return base64Url.encode(values);
  }
}
```

---

## 6. 🎨 UI/UX Design System

### **6.1. Theme Configuration**
```dart
class AppTheme {
  static ThemeData lightTheme = ThemeData(
    primarySwatch: Colors.blue,
    primaryColor: const Color(0xFF1565C0),
    scaffoldBackgroundColor: Colors.white,
    appBarTheme: const AppBarTheme(
      backgroundColor: Color(0xFF1565C0),
      foregroundColor: Colors.white,
      elevation: 0,
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: const Color(0xFF1565C0),
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 12),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
        ),
      ),
    ),
  );
}
```

### **6.2. Custom Widgets**
```dart
class UpiPinInput extends StatefulWidget {
  final Function(String) onPinEntered;
  final bool obscureText;
  
  const UpiPinInput({
    Key? key,
    required this.onPinEntered,
    this.obscureText = true,
  }) : super(key: key);
  
  @override
  State<UpiPinInput> createState() => _UpiPinInputState();
}

class TransactionCard extends StatelessWidget {
  final Transaction transaction;
  
  const TransactionCard({
    Key? key,
    required this.transaction,
  }) : super(key: key);
  
  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: transaction.type == TransactionType.credit
              ? Colors.green
              : Colors.red,
          child: Icon(
            transaction.type == TransactionType.credit
                ? Icons.arrow_downward
                : Icons.arrow_upward,
            color: Colors.white,
          ),
        ),
        title: Text(transaction.description),
        subtitle: Text(
          '${transaction.type == TransactionType.credit ? '+' : '-'}₹${transaction.amount}',
          style: TextStyle(
            color: transaction.type == TransactionType.credit
                ? Colors.green
                : Colors.red,
            fontWeight: FontWeight.bold,
          ),
        ),
        trailing: Text(
          DateFormat('dd MMM, hh:mm a').format(transaction.timestamp),
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ),
    );
  }
}
```

---

## 7. 📊 State Management & Architecture

### **7.1. BLoC Pattern Implementation**
```dart
// Events
abstract class AuthEvent extends Equatable {
  const AuthEvent();
}

class LoginEvent extends AuthEvent {
  final String mobileNumber;
  final String pin;
  
  const LoginEvent({required this.mobileNumber, required this.pin});
  
  @override
  List<Object> get props => [mobileNumber, pin];
}

// States
abstract class AuthState extends Equatable {
  const AuthState();
}

class AuthInitial extends AuthState {
  @override
  List<Object> get props => [];
}

class AuthLoading extends AuthState {
  @override
  List<Object> get props => [];
}

class AuthSuccess extends AuthState {
  final User user;
  
  const AuthSuccess(this.user);
  
  @override
  List<Object> get props => [user];
}

class AuthFailure extends AuthState {
  final String message;
  
  const AuthFailure(this.message);
  
  @override
  List<Object> get props => [message];
}
```

### **7.2. Repository Pattern**
```dart
abstract class AuthRepository {
  Future<Either<Failure, User>> login(String mobileNumber, String pin);
  Future<Either<Failure, void>> logout();
  Future<Either<Failure, User>> register(RegisterParams params);
}

class AuthRepositoryImpl implements AuthRepository {
  final AuthRemoteDataSource remoteDataSource;
  final AuthLocalDataSource localDataSource;
  final NetworkInfo networkInfo;
  
  AuthRepositoryImpl({
    required this.remoteDataSource,
    required this.localDataSource,
    required this.networkInfo,
  });
  
  @override
  Future<Either<Failure, User>> login(String mobileNumber, String pin) async {
    if (await networkInfo.isConnected) {
      try {
        final user = await remoteDataSource.login(mobileNumber, pin);
        await localDataSource.cacheUser(user);
        return Right(user);
      } on ServerException {
        return Left(ServerFailure());
      }
    } else {
      return Left(NetworkFailure());
    }
  }
}
```

---

## 8. 🧪 Testing Strategy

### **8.1. Unit Tests**
```dart
void main() {
  group('TransactionBloc', () {
    late TransactionBloc bloc;
    late MockProcessPaymentUseCase mockProcessPayment;
    
    setUp(() {
      mockProcessPayment = MockProcessPaymentUseCase();
      bloc = TransactionBloc(processPayment: mockProcessPayment);
    });
    
    blocTest<TransactionBloc, TransactionState>(
      'emits [TransactionLoading, TransactionSuccess] when payment succeeds',
      build: () {
        when(() => mockProcessPayment(any()))
            .thenAnswer((_) async => const Right(mockTransaction));
        return bloc;
      },
      act: (bloc) => bloc.add(const ProcessPaymentEvent(
        payerVpa: 'test@upi',
        payeeVpa: 'merchant@upi',
        amount: 100.0,
        pin: '1234',
      )),
      expect: () => [
        TransactionLoading(),
        TransactionSuccess(mockTransaction),
      ],
    );
  });
}
```

### **8.2. Widget Tests**
```dart
void main() {
  group('PinInputWidget', () {
    testWidgets('should display pin input fields', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: PinInputWidget(
              onPinEntered: (pin) {},
            ),
          ),
        ),
      );
      
      expect(find.byType(TextField), findsNWidgets(6));
    });
    
    testWidgets('should call onPinEntered when pin is complete', (tester) async {
      String? enteredPin;
      
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: PinInputWidget(
              onPinEntered: (pin) => enteredPin = pin,
            ),
          ),
        ),
      );
      
      // Enter pin digits
      for (int i = 0; i < 6; i++) {
        await tester.enterText(find.byType(TextField).at(i), '1');
      }
      
      expect(enteredPin, equals('111111'));
    });
  });
}
```

### **8.3. Integration Tests**
```dart
void main() {
  group('Payment Flow Integration', () {
    testWidgets('should complete payment flow successfully', (tester) async {
      await tester.pumpWidget(MyApp());
      
      // Navigate to payment screen
      await tester.tap(find.byKey(const Key('send_money_button')));
      await tester.pumpAndSettle();
      
      // Enter payment details
      await tester.enterText(find.byKey(const Key('payee_vpa_field')), 'test@upi');
      await tester.enterText(find.byKey(const Key('amount_field')), '100');
      
      // Proceed to PIN entry
      await tester.tap(find.byKey(const Key('proceed_button')));
      await tester.pumpAndSettle();
      
      // Enter PIN
      await tester.enterText(find.byKey(const Key('pin_field')), '123456');
      await tester.tap(find.byKey(const Key('pay_button')));
      await tester.pumpAndSettle();
      
      // Verify success screen
      expect(find.text('Payment Successful'), findsOneWidget);
    });
  });
}
```

---

## 9. 📦 Dependencies & Setup

### **9.1. pubspec.yaml**
```yaml
dependencies:
  flutter:
    sdk: flutter
  
  # State Management
  flutter_bloc: ^8.1.3
  equatable: ^2.0.5
  
  # Network & API
  grpc: ^3.2.4
  protobuf: ^3.1.0
  dio: ^5.3.2
  connectivity_plus: ^4.0.2
  
  # Security
  flutter_secure_storage: ^9.0.0
  local_auth: ^2.1.6
  crypto: ^3.0.3
  flutter_jailbreak_detection: ^1.10.0
  screen_protector: ^1.4.2
  
  # UI/UX
  qr_flutter: ^4.1.0
  qr_code_scanner: ^1.0.1
  lottie: ^2.6.0
  shimmer: ^3.0.0
  
  # Utilities
  get_it: ^7.6.4
  injectable: ^2.3.2
  dartz: ^0.10.1
  intl: ^0.18.1

dev_dependencies:
  flutter_test:
    sdk: flutter
  
  # Testing
  bloc_test: ^9.1.4
  mockito: ^5.4.2
  build_runner: ^2.4.7
  injectable_generator: ^2.4.1
  
  # Code Quality
  flutter_lints: ^3.0.0
  very_good_analysis: ^5.1.0
```

### **9.2. Build Configuration**
```yaml
# android/app/build.gradle
android {
    compileSdkVersion 34
    
    defaultConfig {
        minSdkVersion 21
        targetSdkVersion 34
        versionCode flutterVersionCode.toInteger()
        versionName flutterVersionName
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
