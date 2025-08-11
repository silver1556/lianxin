# Lianxin User Service API Documentation

## Overview

The Lianxin User Service is a comprehensive microservice responsible for user authentication, profile management, and account operations for a Chinese social media platform. It provides secure, compliant, and scalable user management with features like OTP-based authentication, field-level encryption, and comprehensive audit logging.

## Base Information

- **Base URL**: `http://localhost:3001/api/v1`
- **Authentication**: Bearer JWT tokens
- **Content-Type**: `application/json`
- **Rate Limiting**: Various limits per endpoint
- **Compliance**: PIPL, Cybersecurity Law, Data Security Law

## Authentication Flow

### JWT Token Structure
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 1800,
  "refresh_expires_in": 604800
}
```

### Headers Required for Authenticated Requests
```
Authorization: Bearer <access_token>
Content-Type: application/json
X-Device-ID: <device_identifier>
X-App-Version: <app_version>
```

---

## 🔐 Authentication Endpoints

### 1. Request Registration OTP

**Endpoint**: `POST /auth/register/otp`

**Purpose**: Initiates user registration by sending OTP to phone number

**Rate Limit**: 5 requests per 5 minutes per phone

**Request Body**:
```json
{
  "phone": "+86-138-0013-8000"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "verification_id": "550e8400-e29b-41d4-a716-446655440000",
    "expires_in": 300,
    "phone": "+86-138-0013-8000"
  },
  "message": "OTP sent successfully",
  "timestamp": "2025-01-20T12:00:00.000Z",
  "request_id": "req_123456"
}
```

**Flutter Implementation**:
```dart
Future<Map<String, dynamic>> requestRegistrationOtp(String phone) async {
  final response = await http.post(
    Uri.parse('$baseUrl/auth/register/otp'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({'phone': phone}),
  );
  
  if (response.statusCode == 200) {
    return jsonDecode(response.body);
  } else {
    throw Exception('Failed to send OTP');
  }
}
```

**Workflow**:
1. User enters phone number
2. System validates phone format
3. Checks rate limiting
4. Generates 6-digit OTP
5. Stores OTP in database with 5-minute expiry
6. Sends SMS via Alibaba Cloud SMS
7. Returns verification ID for next step

---

### 2. User Registration

**Endpoint**: `POST /auth/register`

**Purpose**: Completes user registration with OTP verification

**Rate Limit**: 5 requests per hour per IP

**Request Body**:
```json
{
  "phone": "+86-138-0013-8000",
  "password": "SecurePass123!",
  "verification_id": "550e8400-e29b-41d4-a716-446655440000",
  "otp_code": "123456",
  "agree_terms": true,
  "device_id": "device_12345",
  "device_type": "mobile",
  "device_name": "iPhone 15 Pro"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "uuid": "550e8400-e29b-41d4-a716-446655440001",
      "phone": "+86-138-0013-8000",
      "display_name": null,
      "avatar_url": null,
      "is_verified": false,
      "status": "active",
      "created_at": "2025-01-20T12:00:00.000Z"
    },
    "tokens": {
      "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "token_type": "Bearer",
      "expires_in": 1800,
      "refresh_expires_in": 604800
    },
    "session": {
      "id": "session_12345",
      "expires_at": "2025-01-27T12:00:00.000Z"
    }
  },
  "message": "Registration successful"
}
```

**Flutter Implementation**:
```dart
Future<UserRegistrationResponse> registerUser({
  required String phone,
  required String password,
  required String verificationId,
  required String otpCode,
  required DeviceInfo deviceInfo,
}) async {
  final response = await http.post(
    Uri.parse('$baseUrl/auth/register'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({
      'phone': phone,
      'password': password,
      'verification_id': verificationId,
      'otp_code': otpCode,
      'agree_terms': true,
      'device_id': deviceInfo.deviceId,
      'device_type': deviceInfo.deviceType,
      'device_name': deviceInfo.deviceName,
    }),
  );
  
  if (response.statusCode == 201) {
    final data = jsonDecode(response.body);
    // Store tokens securely
    await _tokenStorage.storeTokens(data['data']['tokens']);
    return UserRegistrationResponse.fromJson(data);
  } else {
    throw RegistrationException(response.body);
  }
}
```

**Workflow**:
1. Verify OTP code and phone number
2. Check phone number uniqueness
3. Validate password strength
4. Hash password with bcrypt
5. Create user record with encrypted sensitive data
6. Create default user settings
7. Generate JWT token pair
8. Create user session
9. Return user data and tokens

---

### 3. Request Login OTP

**Endpoint**: `POST /auth/login/otp`

**Purpose**: Sends OTP for passwordless login

**Rate Limit**: 5 requests per 5 minutes per phone

**Request Body**:
```json
{
  "phone": "+86-138-0013-8000"
}
```

**Response**: Same as registration OTP

**Flutter Implementation**:
```dart
Future<Map<String, dynamic>> requestLoginOtp(String phone) async {
  final response = await http.post(
    Uri.parse('$baseUrl/auth/login/otp'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({'phone': phone}),
  );
  
  return _handleResponse(response);
}
```

---

### 4. User Login

**Endpoint**: `POST /auth/login`

**Purpose**: Authenticates user with password or OTP

**Rate Limit**: 10 requests per 15 minutes per IP+phone

**Request Body (Password Login)**:
```json
{
  "phone": "+86-138-0013-8000",
  "password": "SecurePass123!",
  "device_id": "device_12345",
  "device_type": "mobile",
  "device_name": "iPhone 15 Pro"
}
```

**Request Body (OTP Login)**:
```json
{
  "phone": "+86-138-0013-8000",
  "verification_id": "550e8400-e29b-41d4-a716-446655440000",
  "otp_code": "123456",
  "device_id": "device_12345",
  "device_type": "mobile",
  "device_name": "iPhone 15 Pro"
}
```

**Response**: Same as registration response

**Flutter Implementation**:
```dart
// Password login
Future<LoginResponse> loginWithPassword({
  required String phone,
  required String password,
  required DeviceInfo deviceInfo,
}) async {
  final response = await http.post(
    Uri.parse('$baseUrl/auth/login'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({
      'phone': phone,
      'password': password,
      'device_id': deviceInfo.deviceId,
      'device_type': deviceInfo.deviceType,
      'device_name': deviceInfo.deviceName,
    }),
  );
  
  return _handleLoginResponse(response);
}

// OTP login
Future<LoginResponse> loginWithOtp({
  required String phone,
  required String verificationId,
  required String otpCode,
  required DeviceInfo deviceInfo,
}) async {
  final response = await http.post(
    Uri.parse('$baseUrl/auth/login'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({
      'phone': phone,
      'verification_id': verificationId,
      'otp_code': otpCode,
      'device_id': deviceInfo.deviceId,
      'device_type': deviceInfo.deviceType,
      'device_name': deviceInfo.deviceName,
    }),
  );
  
  return _handleLoginResponse(response);
}
```

**Workflow**:
1. Validate phone number format
2. Find user by phone
3. Check account status (active, suspended, locked)
4. Authenticate via password or OTP
5. Reset failed login attempts on success
6. Update login tracking
7. Create new session
8. Generate JWT tokens
9. Return user data and tokens

---

### 5. Token Refresh

**Endpoint**: `POST /auth/refresh`

**Purpose**: Refreshes expired access token using refresh token

**Request Body**:
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "tokens": {
      "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "token_type": "Bearer",
      "expires_in": 1800
    }
  },
  "message": "Tokens refreshed successfully"
}
```

**Flutter Implementation**:
```dart
Future<TokenResponse> refreshToken(String refreshToken) async {
  final response = await http.post(
    Uri.parse('$baseUrl/auth/refresh'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({'refresh_token': refreshToken}),
  );
  
  if (response.statusCode == 200) {
    final data = jsonDecode(response.body);
    await _tokenStorage.updateAccessToken(data['data']['tokens']['access_token']);
    return TokenResponse.fromJson(data);
  } else {
    // Refresh token expired, redirect to login
    await _handleTokenExpiry();
    throw TokenExpiredException();
  }
}
```

---

### 6. User Logout

**Endpoint**: `POST /auth/logout`

**Purpose**: Logs out user and invalidates session

**Headers**: `Authorization: Bearer <access_token>`

**Response**:
```json
{
  "success": true,
  "data": null,
  "message": "Logged out successfully"
}
```

**Flutter Implementation**:
```dart
Future<void> logout() async {
  final token = await _tokenStorage.getAccessToken();
  
  final response = await http.post(
    Uri.parse('$baseUrl/auth/logout'),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    },
  );
  
  // Clear local storage regardless of response
  await _tokenStorage.clearTokens();
  await _userStorage.clearUserData();
  
  if (response.statusCode != 200) {
    // Log error but don't throw since we cleared local data
    print('Logout request failed: ${response.body}');
  }
}
```

---

### 7. Request Password Reset OTP

**Endpoint**: `POST /auth/forgot-password/otp`

**Purpose**: Sends OTP for password reset

**Rate Limit**: 3 requests per hour per phone

**Request Body**:
```json
{
  "phone": "+86-138-0013-8000"
}
```

**Response**: Same as other OTP responses

---

### 8. Reset Password

**Endpoint**: `POST /auth/reset-password`

**Purpose**: Resets user password using OTP verification

**Rate Limit**: 3 requests per hour per phone

**Request Body**:
```json
{
  "phone": "+86-138-0013-8000",
  "verification_id": "550e8400-e29b-41d4-a716-446655440000",
  "otp_code": "123456",
  "new_password": "NewSecurePass123!",
  "confirm_password": "NewSecurePass123!"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "Password reset successful"
  },
  "message": "Password has been reset successfully"
}
```

**Flutter Implementation**:
```dart
Future<void> resetPassword({
  required String phone,
  required String verificationId,
  required String otpCode,
  required String newPassword,
}) async {
  final response = await http.post(
    Uri.parse('$baseUrl/auth/reset-password'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({
      'phone': phone,
      'verification_id': verificationId,
      'otp_code': otpCode,
      'new_password': newPassword,
      'confirm_password': newPassword,
    }),
  );
  
  if (response.statusCode == 200) {
    // Password reset successful, redirect to login
    Navigator.pushReplacementNamed(context, '/login');
  } else {
    throw PasswordResetException(response.body);
  }
}
```

---

## 👤 Profile Management Endpoints

### 9. Get User Profile

**Endpoint**: `GET /user/profile`

**Purpose**: Retrieves current user's complete profile

**Headers**: `Authorization: Bearer <access_token>`

**Response**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "uuid": "550e8400-e29b-41d4-a716-446655440001",
      "phone": "+86-138-0013-8000",
      "display_name": "John Doe",
      "first_name": "John",
      "last_name": "Doe",
      "bio": "Software developer passionate about technology",
      "avatar_url": "https://cdn.lianxin.com/avatars/avatar_1_1642680000.jpg",
      "cover_photo_url": "https://cdn.lianxin.com/covers/cover_1_1642680000.jpg",
      "birth_date": "1990-01-01",
      "gender": "male",
      "location": "Beijing, China",
      "website": "https://johndoe.dev",
      "occupation": "Software Developer",
      "education": "Computer Science",
      "relationship_status": "single",
      "languages": ["zh-CN", "en-US"],
      "is_verified": true,
      "is_private": false,
      "status": "active",
      "last_login": "2025-01-20T11:30:00.000Z",
      "created_at": "2025-01-15T10:00:00.000Z"
    }
  },
  "message": "Profile retrieved successfully"
}
```

**Flutter Implementation**:
```dart
Future<UserProfile> getUserProfile() async {
  final token = await _tokenStorage.getAccessToken();
  
  final response = await http.get(
    Uri.parse('$baseUrl/user/profile'),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    },
  );
  
  if (response.statusCode == 200) {
    final data = jsonDecode(response.body);
    return UserProfile.fromJson(data['data']['user']);
  } else {
    throw ProfileException('Failed to load profile');
  }
}
```

---

### 10. Update User Profile

**Endpoint**: `PUT /user/profile`

**Purpose**: Updates user profile information

**Headers**: `Authorization: Bearer <access_token>`

**Rate Limit**: 10 requests per minute per user

**Request Body**:
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "display_name": "johndoe",
  "bio": "Updated bio text",
  "location": "Shanghai, China",
  "website": "https://newwebsite.com",
  "occupation": "Senior Developer",
  "education": "Master's in CS",
  "relationship_status": "in_relationship",
  "birth_date": "1990-01-01",
  "gender": "male",
  "languages": ["zh-CN", "en-US", "ja-JP"]
}
```

**Response**:
```json
{
  "success": true,
  "data": null,
  "message": "User profile updated successfully"
}
```

**Flutter Implementation**:
```dart
Future<void> updateProfile(UserProfileUpdate profileUpdate) async {
  final token = await _tokenStorage.getAccessToken();
  
  final response = await http.put(
    Uri.parse('$baseUrl/user/profile'),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    },
    body: jsonEncode(profileUpdate.toJson()),
  );
  
  if (response.statusCode == 200) {
    // Update local cache
    await _userStorage.updateProfile(profileUpdate);
  } else {
    throw ProfileUpdateException(response.body);
  }
}
```

---

### 11. Upload Avatar

**Endpoint**: `POST /user/avatar`

**Purpose**: Uploads user avatar image

**Headers**: 
- `Authorization: Bearer <access_token>`
- `Content-Type: multipart/form-data`

**Rate Limit**: 5 requests per minute per user

**Request**: Multipart form with `avatar` file field

**File Requirements**:
- Formats: JPEG, PNG, WebP
- Max size: 5MB
- Recommended: 400x400px

**Response**:
```json
{
  "success": true,
  "data": {
    "avatar_url": "https://cdn.lianxin.com/avatars/avatar_1_1642680000.jpg"
  },
  "message": "Avatar uploaded successfully"
}
```

**Flutter Implementation**:
```dart
Future<String> uploadAvatar(File imageFile) async {
  final token = await _tokenStorage.getAccessToken();
  
  var request = http.MultipartRequest(
    'POST',
    Uri.parse('$baseUrl/user/avatar'),
  );
  
  request.headers['Authorization'] = 'Bearer $token';
  request.files.add(await http.MultipartFile.fromPath(
    'avatar',
    imageFile.path,
    contentType: MediaType('image', 'jpeg'),
  ));
  
  final response = await request.send();
  final responseBody = await response.stream.bytesToString();
  
  if (response.statusCode == 200) {
    final data = jsonDecode(responseBody);
    return data['data']['avatar_url'];
  } else {
    throw AvatarUploadException(responseBody);
  }
}
```

---

### 12. Upload Cover Photo

**Endpoint**: `POST /user/cover-photo`

**Purpose**: Uploads user cover photo

**Headers**: 
- `Authorization: Bearer <access_token>`
- `Content-Type: multipart/form-data`

**Rate Limit**: 5 requests per minute per user

**Request**: Multipart form with `cover_photo` file field

**File Requirements**:
- Formats: JPEG, PNG, WebP
- Max size: 10MB
- Recommended: 1200x400px

**Response**:
```json
{
  "success": true,
  "data": {
    "cover_photo_url": "https://cdn.lianxin.com/covers/cover_1_1642680000.jpg"
  },
  "message": "Cover photo uploaded successfully"
}
```

**Flutter Implementation**: Similar to avatar upload

---

### 13. Get Public User Profile

**Endpoint**: `GET /api/v1/user/public/:userId`

**Purpose**: Retrieves public profile information for any user

**Headers**: `Authorization: Bearer <access_token>` (Optional)

**Rate Limit**: 100 requests per minute per IP

**Response**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 2,
      "uuid": "550e8400-e29b-41d4-a716-446655440002",
      "display_name": "Jane Smith",
      "first_name": "Jane",
      "last_name": "Smith",
      "bio": "Software engineer passionate about mobile development",
      "avatar_url": "https://cdn.lianxin.com/avatars/avatar_2_1642680000.jpg",
      "cover_photo_url": "https://cdn.lianxin.com/covers/cover_2_1642680000.jpg",
      "location": "Shanghai, China",
      "website": "https://janesmith.dev",
      "occupation": "Software Engineer",
      "education": "Computer Science",
      "is_verified": true,
      "is_private": false,
      "status": "active",
      "created_at": "2025-01-10T10:00:00.000Z"
    }
  },
  "message": "Public profile retrieved successfully"
}
```

**Private Profile Response**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 3,
      "uuid": "550e8400-e29b-41d4-a716-446655440003",
      "display_name": "Private User",
      "avatar_url": "https://cdn.lianxin.com/avatars/avatar_3_1642680000.jpg",
      "is_verified": false,
      "is_private": true,
      "status": "active",
      "created_at": "2025-01-12T10:00:00.000Z"
    }
  },
  "message": "Public profile retrieved successfully"
}
```

**Flutter Implementation**:
```dart
Future<UserProfile> getPublicUserProfile(String userId) async {
  final token = await _tokenStorage.getAccessToken();
  
  final headers = {
    'Content-Type': 'application/json',
  };
  
  // Add authorization header if token is available (optional auth)
  if (token != null) {
    headers['Authorization'] = 'Bearer $token';
  }
  
  final response = await http.get(
    Uri.parse('$baseUrl/users/public/$userId'),
    headers: headers,
  );
  
  if (response.statusCode == 200) {
    final data = jsonDecode(response.body);
    return UserProfile.fromJson(data['data']['user']);
  } else if (response.statusCode == 404) {
    throw ProfileException('User not found');
  } else {
    throw ProfileException('Failed to load user profile');
  }
}
```

**Workflow**:
1. Extract user ID from URL parameters
2. Check if user exists and is active
3. Decrypt user data
4. Apply privacy filtering based on `is_private` status
5. Return appropriate level of profile information
6. Log profile access for analytics

---

## ⚙️ Settings Management Endpoints

### 15. Get User Settings

**Endpoint**: `GET /user/settings`

**Purpose**: Retrieves user settings and preferences

**Headers**: `Authorization: Bearer <access_token>`

**Response**:
```json
{
  "success": true,
  "data": {
    "settings": {
      "privacy": {
        "profile_visibility":"public",
        "search_visibility":true,
        "show_online_status":true,
        "allow_friend_requests":true,
        "message_permissions":"friends",
        "allow_tagging":"friends"
      },
      "notifications": {
        "push_notifications":true,
        "friend_requests":true,
        "messages":true,
        "likes":true,
        "comments":true,
        "shares":false,
        "mentions":true,
        "group_activities":true,
        "event_reminders":true,
        "security_alerts":true
      },
      "display": {
        "theme": "light",
        "language": "zh-CN",
        "font_size": "medium"
      },
      "security": {
        "login_alerts": true,
      }
    }
  },
  "message": "Settings retrieved successfully"
}
```

**Flutter Implementation**:
```dart
Future<UserSettings> getUserSettings() async {
  final token = await _tokenStorage.getAccessToken();
  
  final response = await http.get(
    Uri.parse('$baseUrl/user/settings'),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    },
  );
  
  if (response.statusCode == 200) {
    final data = jsonDecode(response.body);
    return UserSettings.fromJson(data['data']['settings']);
  } else {
    throw SettingsException('Failed to load settings');
  }
}
```

---

### 16. Update User Settings

**Endpoint**: `PUT /user/settings`

**Purpose**: Updates user settings (partial updates allowed)

**Headers**: `Authorization: Bearer <access_token>`

**Rate Limit**: 15 requests per minute per user

**Request Body**:
```json
{
  "privacy": {
    "profile_visibility": "public",
    "show_online_status": true
  },
  "notifications": {
    "push_notifications": false,
    "likes": true
  },
  "display": {
    "theme": "dark",
    "language": "en-US"
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": null,
  "message": "Settings updated successfully"
}
```

**Flutter Implementation**:
```dart
Future<void> updateSettings(Map<String, dynamic> settingsUpdate) async {
  final token = await _tokenStorage.getAccessToken();
  
  final response = await http.put(
    Uri.parse('$baseUrl/user/settings'),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    },
    body: jsonEncode(settingsUpdate),
  );
  
  if (response.statusCode == 200) {
    // Update local settings cache
    await _settingsStorage.updateSettings(settingsUpdate);
  } else {
    throw SettingsUpdateException(response.body);
  }
}
```

---

### 17. Change Password

**Endpoint**: `PUT /user/password-change`

**Purpose**: Changes user password with current password verification

**Headers**: `Authorization: Bearer <access_token>`

**Rate Limit**: 3 requests per hour per user

**Request Body**:
```json
{
  "current_password": "OldPassword123!",
  "new_password": "NewSecurePass123!",
  "confirm_password": "NewSecurePass123!"
}
```

**Response**:
```json
{
  "success": true,
  "data": null,
  "message": "Password changed successfully"
}
```

**Flutter Implementation**:
```dart
Future<void> changePassword({
  required String currentPassword,
  required String newPassword,
}) async {
  final token = await _tokenStorage.getAccessToken();
  
  final response = await http.put(
    Uri.parse('$baseUrl/user/password-change'),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    },
    body: jsonEncode({
      'current_password': currentPassword,
      'new_password': newPassword,
      'confirm_password': newPassword,
    }),
  );
  
  if (response.statusCode == 200) {
    // Password changed, all other sessions revoked
    // Current session remains active
    _showSuccessMessage('Password changed successfully');
  } else {
    throw PasswordChangeException(response.body);
  }
}
```

---

### 18. Request Phone Change OTP

**Endpoint**: `POST /user/phone/otp`

**Purpose**: Sends OTP to new phone number for verification

**Headers**: `Authorization: Bearer <access_token>`

**Rate Limit**: 5 requests per 5 minutes per user

**Request Body**:
```json
{
  "new_phone": "+86-138-0013-8001"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "verification_id": "550e8400-e29b-41d4-a716-446655440000",
    "expires_in": 300,
    "new_phone": "+86-138-0013-8001"
  },
  "message": "OTP sent to new phone number"
}
```

---

### 19. Change Phone Number

**Endpoint**: `PUT /user/phone-number-change`

**Purpose**: Changes user phone number with OTP and password verification

**Headers**: `Authorization: Bearer <access_token>`

**Rate Limit**: 3 requests per hour per user

**Request Body**:
```json
{
  "new_phone": "+86-138-0013-8001",
  "verification_id": "550e8400-e29b-41d4-a716-446655440000",
  "otp_code": "123456",
  "password": "CurrentPassword123!"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "Phone number changed successfully",
    "new_phone": "+86-138-0013-8001"
  },
  "message": "Phone number updated successfully"
}
```

---

### 20. Deactivate Account

**Endpoint**: `POST /user/deactivate`

**Purpose**: Temporarily deactivates user account

**Headers**: `Authorization: Bearer <access_token>`

**Rate Limit**: 3 requests per hour per user

**Request Body**:
```json
{
  "password": "CurrentPassword123!"
}
```

**Response**:
```json
{
  "success": true,
  "data": null,
  "message": "Account successfully deactivated. You have been logged out."
}
```

---

### 21. Request Account Deletion

**Endpoint**: `POST /user/request-deletion`

**Purpose**: Schedules account for permanent deletion (15-day grace period)

**Headers**: `Authorization: Bearer <access_token>`

**Rate Limit**: 3 requests per hour per user

**Request Body**:
```json
{
  "password": "CurrentPassword123!"
}
```

**Response**:
```json
{
  "success": true,
  "data": null,
  "message": "Your account is now scheduled for permanent deletion. You have 15 days to cancel this request by logging in. You have been logged out."
}
```

---

## 🔒 Session Management Endpoints

### 22. Get Active Sessions

**Endpoint**: `GET /user/sessions`

**Purpose**: Lists all active sessions for the user

**Headers**: `Authorization: Bearer <access_token>`

**Response**:
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": "session_12345",
        "device_info": {
          "device_id": "device_12345",
          "device_type": "mobile",
          "device_name": "iPhone 15 Pro",
          "os": "iOS",
          "browser": "Safari"
        },
        "ip_address": "192.168.1.100",
        "location": "Beijing, China",
        "is_current": true,
        "last_active": "2025-01-20T12:00:00.000Z",
        "created_at": "2025-01-20T10:00:00.000Z",
        "expires_at": "2025-01-27T10:00:00.000Z"
      }
    ]
  },
  "message": "Active sessions retrieved successfully"
}
```

**Flutter Implementation**:
```dart
Future<List<UserSession>> getActiveSessions() async {
  final token = await _tokenStorage.getAccessToken();
  
  final response = await http.get(
    Uri.parse('$baseUrl/user/sessions'),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    },
  );
  
  if (response.statusCode == 200) {
    final data = jsonDecode(response.body);
    return (data['data']['sessions'] as List)
        .map((session) => UserSession.fromJson(session))
        .toList();
  } else {
    throw SessionException('Failed to load sessions');
  }
}
```

---

### 23. Revoke Specific Session

**Endpoint**: `DELETE /user/sessions/:sessionId`

**Purpose**: Revokes a specific session

**Headers**: `Authorization: Bearer <access_token>`

**Rate Limit**: 20 requests per minute per user

**Request Body**:
```json
{
  "password": "CurrentPassword123!"
}
```

**Response**:
```json
{
  "success": true,
  "data": null,
  "message": "Session revoked successfully"
}
```

---

### 24. Revoke All Other Sessions

**Endpoint**: `POST /user/sessions/revoke-all`

**Purpose**: Revokes all sessions except current one

**Headers**: `Authorization: Bearer <access_token>`

**Rate Limit**: 20 requests per minute per user

**Request Body**:
```json
{
  "password": "CurrentPassword123!"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "revoked_sessions": 3
  },
  "message": "3 sessions revoked successfully"
}
```

**Flutter Implementation**:
```dart
Future<int> revokeAllOtherSessions(String password) async {
  final token = await _tokenStorage.getAccessToken();
  
  final response = await http.post(
    Uri.parse('$baseUrl/user/sessions/revoke-all'),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    },
    body: jsonEncode({'password': password}),
  );
  
  if (response.statusCode == 200) {
    final data = jsonDecode(response.body);
    return data['data']['revoked_sessions'];
  } else {
    throw SessionException(response.body);
  }
}
```

---

## 👨‍💼 Admin Endpoints

### 25. Get User List (Admin)

**Endpoint**: `GET /admin/users`

**Purpose**: Retrieves paginated list of users for admin management

**Headers**: `Authorization: Bearer <admin_access_token>`

**Rate Limit**: 50 requests per minute per admin

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Users per page (1-100, default: 50)
- `status` (optional): Filter by status (active, deactivated, pending_deletion, suspended)
- `search` (optional): Search query (1-100 characters)

**Response**:
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": 1,
        "uuid": "550e8400-e29b-41d4-a716-446655440001",
        "phone": "+86-138-0013-8000",
        "display_name": "John Doe",
        "avatar_url": "https://cdn.lianxin.com/avatars/avatar_1.jpg",
        "is_verified": true,
        "status": "active",
        "last_login": "2025-01-20T11:30:00.000Z",
        "login_count": 45,
        "created_at": "2025-01-15T10:00:00.000Z"
      }
    ],
    "total_count": 1000,
    "page": 1,
    "limit": 50,
    "total_pages": 20
  },
  "message": "User list retrieved successfully"
}
```

---

### 26. Suspend User (Admin)

**Endpoint**: `POST /admin/users/:userId/suspend`

**Purpose**: Suspends user account for specified duration

**Headers**: `Authorization: Bearer <admin_access_token>`

**Request Body**:
```json
{
  "reason": "Violation of community guidelines",
  "duration": 7,
  "admin_note": "User posted inappropriate content"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "User suspended successfully",
    "suspension_until": "2025-01-27T12:00:00.000Z"
  },
  "message": "User 1 suspended until 2025-01-27T12:00:00.000Z"
}
```

---

### 27. Get Audit Logs (Admin)

**Endpoint**: `GET /admin/audit-logs`

**Purpose**: Retrieves system audit logs for compliance

**Headers**: `Authorization: Bearer <admin_access_token>`

**Query Parameters**:
- `page`, `limit`: Pagination
- `user_id`: Filter by specific user
- `action`: Filter by action type
- `resource`: Filter by resource type
- `start_date`, `end_date`: Date range filter

**Response**:
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": 1,
        "user_id": 1,
        "action": "profile_update",
        "resource": "user_profile",
        "resource_id": "1",
        "old_values": {"display_name": "Old Name"},
        "new_values": {"display_name": "New Name"},
        "ip_address": "192.168.1.100",
        "user_agent": "Mozilla/5.0...",
        "created_at": "2025-01-20T12:00:00.000Z"
      }
    ],
    "total_count": 5000,
    "page": 1,
    "limit": 50
  },
  "message": "Audit logs retrieved successfully"
}
```

---

## Error Handling

### Standard Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {
      "field": "specific_field",
      "constraint": "validation_rule"
    }
  },
  "timestamp": "2025-01-20T12:00:00.000Z",
  "request_id": "req_123456"
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `AUTHENTICATION_ERROR` | 401 | Invalid or missing authentication |
| `AUTHORIZATION_ERROR` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict (e.g., duplicate phone) |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_SERVER_ERROR` | 500 | Server error |

### Flutter Error Handling
```dart
class ApiService {
  Future<T> _handleResponse<T>(
    http.Response response,
    T Function(Map<String, dynamic>) fromJson,
  ) async {
    final data = jsonDecode(response.body);
    
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return fromJson(data);
    } else {
      final error = data['error'];
      switch (error['code']) {
        case 'AUTHENTICATION_ERROR':
        case 'EXPIRED_TOKEN':
          await _handleTokenExpiry();
          throw AuthenticationException(error['message']);
        case 'VALIDATION_ERROR':
          throw ValidationException(error['message'], error['details']);
        case 'RATE_LIMIT_EXCEEDED':
          throw RateLimitException(error['message']);
        default:
          throw ApiException(error['message'], response.statusCode);
      }
    }
  }
}
```

---

## Security Features

### 1. Field-Level Encryption
Sensitive fields are encrypted using AES-256-GCM:
- Phone numbers
- Names (first_name, last_name)
- Birth dates
- Locations
- Verification data

### 2. Password Security
- Bcrypt hashing with 12 rounds
- Strength validation (8+ chars, mixed case, numbers, symbols)
- Common pattern detection
- Password history tracking

### 3. Session Management
- JWT tokens with rotation
- Device fingerprinting
- Session timeout (30 minutes default)
- Maximum 5 concurrent sessions per user

### 4. Rate Limiting
- Global: 1000 requests/hour per IP
- Authentication: 10 attempts/15 minutes
- OTP: 5 requests/5 minutes per phone
- Registration: 5 attempts/hour per IP

### 5. Audit Logging
- All user actions logged
- 7-year retention for compliance
- Encrypted sensitive data in logs
- Admin action tracking

---

## Flutter Integration Guide

### 1. Setup HTTP Client
```dart
class ApiClient {
  static const String baseUrl = 'http://localhost:3001/api/v1';
  final http.Client _client = http.Client();
  final TokenStorage _tokenStorage = TokenStorage();
  
  Future<Map<String, String>> _getHeaders({bool requireAuth = false}) async {
    final headers = {
      'Content-Type': 'application/json',
      'X-Device-ID': await DeviceInfo.getDeviceId(),
      'X-App-Version': await PackageInfo.fromPlatform().then((info) => info.version),
    };
    
    if (requireAuth) {
      final token = await _tokenStorage.getAccessToken();
      if (token != null) {
        headers['Authorization'] = 'Bearer $token';
      }
    }
    
    return headers;
  }
}
```

### 2. Token Management
```dart
class TokenStorage {
  static const String _accessTokenKey = 'access_token';
  static const String _refreshTokenKey = 'refresh_token';
  
  Future<void> storeTokens(Map<String, dynamic> tokens) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_accessTokenKey, tokens['access_token']);
    await prefs.setString(_refreshTokenKey, tokens['refresh_token']);
  }
  
  Future<String?> getAccessToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_accessTokenKey);
  }
  
  Future<void> clearTokens() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_accessTokenKey);
    await prefs.remove(_refreshTokenKey);
  }
}
```

### 3. Automatic Token Refresh
```dart
class ApiInterceptor {
  Future<http.Response> _makeRequest(
    Future<http.Response> Function() request,
  ) async {
    var response = await request();
    
    if (response.statusCode == 401) {
      // Try to refresh token
      final refreshed = await _refreshToken();
      if (refreshed) {
        // Retry original request
        response = await request();
      } else {
        // Redirect to login
        await _redirectToLogin();
      }
    }
    
    return response;
  }
  
  Future<bool> _refreshToken() async {
    try {
      final refreshToken = await _tokenStorage.getRefreshToken();
      if (refreshToken == null) return false;
      
      final response = await http.post(
        Uri.parse('$baseUrl/auth/refresh'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'refresh_token': refreshToken}),
      );
      
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        await _tokenStorage.updateAccessToken(data['data']['tokens']['access_token']);
        return true;
      }
      
      return false;
    } catch (e) {
      return false;
    }
  }
}
```

### 4. User State Management (Provider/Bloc)
```dart
class UserProvider extends ChangeNotifier {
  UserProfile? _user;
  UserSettings? _settings;
  bool _isLoading = false;
  
  UserProfile? get user => _user;
  UserSettings? get settings => _settings;
  bool get isLoading => _isLoading;
  
  Future<void> loadUserProfile() async {
    _isLoading = true;
    notifyListeners();
    
    try {
      _user = await _apiService.getUserProfile();
      _settings = await _apiService.getUserSettings();
    } catch (e) {
      // Handle error
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  Future<void> updateProfile(UserProfileUpdate update) async {
    try {
      await _apiService.updateProfile(update);
      await loadUserProfile(); // Refresh data
    } catch (e) {
      throw ProfileUpdateException(e.toString());
    }
  }
}
```

### 5. OTP Verification Widget
```dart
class OtpVerificationScreen extends StatefulWidget {
  final String phone;
  final String verificationId;
  final VoidCallback onVerified;
  
  @override
  _OtpVerificationScreenState createState() => _OtpVerificationScreenState();
}

class _OtpVerificationScreenState extends State<OtpVerificationScreen> {
  final _otpController = TextEditingController();
  bool _isLoading = false;
  
  Future<void> _verifyOtp() async {
    setState(() => _isLoading = true);
    
    try {
      await ApiService.verifyOtp(
        verificationId: widget.verificationId,
        otpCode: _otpController.text,
        phone: widget.phone,
      );
      
      widget.onVerified();
    } catch (e) {
      _showError(e.toString());
    } finally {
      setState(() => _isLoading = false);
    }
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          Text('Enter the 6-digit code sent to ${widget.phone}'),
          TextField(
            controller: _otpController,
            keyboardType: TextInputType.number,
            maxLength: 6,
          ),
          ElevatedButton(
            onPressed: _isLoading ? null : _verifyOtp,
            child: _isLoading 
              ? CircularProgressIndicator() 
              : Text('Verify'),
          ),
        ],
      ),
    );
  }
}
```

---

## Compliance and Security

### PIPL Compliance
- User consent tracking
- Data minimization
- Right to deletion (15-day grace period)
- Data export capabilities
- Audit trail maintenance

### Cybersecurity Law Compliance
- Real-name verification support
- Content moderation
- Security incident logging
- Government reporting capabilities

### Data Security Law Compliance
- Data classification
- Encryption at rest and in transit
- Access control and monitoring
- Regular security assessments

---

## Monitoring and Logging

### Health Check
**Endpoint**: `GET /health`

**Response**:
```json
{
  "success": true,
  "data": {
    "service": "user-service",
    "status": "healthy",
    "uptime": 86400,
    "version": "1.0.0"
  },
  "message": "Service is healthy"
}
```

### Metrics Collection
- API response times
- Error rates
- Authentication success/failure rates
- Session statistics
- Database performance

---

This documentation provides a comprehensive guide for integrating with the Lianxin User Service API. The service is designed with security, compliance, and scalability in mind, making it suitable for a production social media platform in the Chinese market.