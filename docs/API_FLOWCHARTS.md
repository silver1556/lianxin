# Lianxin User Service API Flowcharts

## 1. User Registration Flow

```mermaid
flowchart TD
    A[User enters phone number] --> B[POST /auth/register/otp]
    B --> C{Phone format valid?}
    C -->|No| D[Return validation error]
    C -->|Yes| E{Rate limit check}
    E -->|Exceeded| F[Return rate limit error]
    E -->|OK| G[Generate 6-digit OTP]
    G --> H[Store OTP in database<br/>5-minute expiry]
    H --> I[Send SMS via Alibaba Cloud]
    I --> J[Return verification_id]
    
    J --> K[User enters OTP + password]
    K --> L[POST /auth/register]
    L --> M{OTP valid?}
    M -->|No| N[Return OTP error]
    M -->|Yes| O{Phone unique?}
    O -->|No| P[Return duplicate error]
    O -->|Yes| Q{Password strong?}
    Q -->|No| R[Return password error]
    Q -->|Yes| S[Hash password with bcrypt]
    S --> T[Encrypt sensitive data]
    T --> U[Create user record]
    U --> V[Create default settings]
    V --> W[Generate JWT tokens]
    W --> X[Create session]
    X --> Y[Return user + tokens]
    
    style A fill:#e1f5fe
    style Y fill:#c8e6c9
    style D,F,N,P,R fill:#ffcdd2
```

## 2. User Login Flow

```mermaid
flowchart TD
    A[User chooses login method] --> B{Password or OTP?}
    
    B -->|Password| C[POST /auth/login with password]
    B -->|OTP| D[POST /auth/login/otp]
    D --> E[Generate & send OTP]
    E --> F[POST /auth/login with OTP]
    
    C --> G{Phone exists?}
    F --> G
    G -->|No| H[Return invalid credentials]
    G -->|Yes| I{Account status OK?}
    I -->|Suspended| J[Return suspension error]
    I -->|Locked| K[Return lockout error]
    I -->|Deactivated| L[Reactivate account]
    I -->|Active| M{Authentication valid?}
    L --> M
    
    M -->|No| N[Increment failed attempts]
    N --> O{Max attempts reached?}
    O -->|Yes| P[Lock account]
    O -->|No| Q[Return invalid credentials]
    
    M -->|Yes| R[Reset failed attempts]
    R --> S[Update login tracking]
    S --> T[Check session limit]
    T --> U[Create new session]
    U --> V[Generate JWT tokens]
    V --> W[Return user + tokens]
    
    style A fill:#e1f5fe
    style W fill:#c8e6c9
    style H,J,K,P,Q fill:#ffcdd2
```

## 3. Profile Update Flow

```mermaid
flowchart TD
    A[User modifies profile] --> B[PUT /user/profile]
    B --> C{JWT valid?}
    C -->|No| D[Return auth error]
    C -->|Yes| E{Session valid?}
    E -->|No| F[Return session error]
    E -->|Yes| G[Validate profile data]
    G --> H{Validation passed?}
    H -->|No| I[Return validation errors]
    H -->|Yes| J{Bio content appropriate?}
    J -->|No| K[Return content moderation error]
    J -->|Yes| L[Encrypt sensitive fields]
    L --> M[Update user record]
    M --> N[Log audit trail]
    N --> O[Return success]
    
    style A fill:#e1f5fe
    style O fill:#c8e6c9
    style D,F,I,K fill:#ffcdd2
```

## 4. Password Change Flow

```mermaid
flowchart TD
    A[User requests password change] --> B[PUT /user/password-change]
    B --> C{JWT valid?}
    C -->|No| D[Return auth error]
    C -->|Yes| E[Get user from database]
    E --> F{Current password correct?}
    F -->|No| G[Return invalid password]
    F -->|Yes| H{New password strong?}
    H -->|No| I[Return password requirements]
    H -->|Yes| J{Password in history?}
    J -->|Yes| K[Return history error]
    J -->|No| L[Hash new password]
    L --> M[Update password + timestamp]
    M --> N[Revoke all other sessions]
    N --> O[Log security event]
    O --> P[Return success]
    
    style A fill:#e1f5fe
    style P fill:#c8e6c9
    style D,G,I,K fill:#ffcdd2
```

## 5. Phone Number Change Flow

```mermaid
flowchart TD
    A[User enters new phone] --> B[POST /user/phone/otp]
    B --> C{JWT valid?}
    C -->|No| D[Return auth error]
    C -->|Yes| E{New phone unique?}
    E -->|No| F[Return duplicate error]
    E -->|Yes| G[Generate OTP]
    G --> H[Send to new phone]
    H --> I[Return verification_id]
    
    I --> J[User enters OTP + password]
    J --> K[PUT /user/phone-number-change]
    K --> L{Password correct?}
    L -->|No| M[Return invalid password]
    L -->|Yes| N{OTP valid?}
    N -->|No| O[Return OTP error]
    N -->|Yes| P{Phone still unique?}
    P -->|No| Q[Return duplicate error]
    P -->|Yes| R[Update phone number]
    R --> S[Mark phone as verified]
    S --> T[Log audit trail]
    T --> U[Return success]
    
    style A fill:#e1f5fe
    style U fill:#c8e6c9
    style D,F,M,O,Q fill:#ffcdd2
```

## 6. Session Management Flow

```mermaid
flowchart TD
    A[User views sessions] --> B[GET /user/sessions]
    B --> C{JWT valid?}
    C -->|No| D[Return auth error]
    C -->|Yes| E[Get active sessions]
    E --> F[Filter expired sessions]
    F --> G[Mark current session]
    G --> H[Return session list]
    
    H --> I[User selects session to revoke]
    I --> J[DELETE /user/sessions/:id<br/>(with password)]
    J --> K{Password correct?}
    K -->|No| L[Return invalid password]
    K -->|Yes| M{User owns session?}
    M -->|No| N[Return invalid password]
    M -->|Yes| O{User owns session?}
    O -->|No| P[Return forbidden error]
    O -->|Yes| Q[Revoke session]
    Q --> R[Log security event]
    R --> S[Return success]
    
    style A fill:#e1f5fe;
    style H,S fill:#c8e6c9;
    style D,L,N,P fill:#ffcdd2;
```

## 7. Account Deletion Flow

```mermaid
flowchart TD
    A[User requests deletion] --> B[POST /user/request-deletion]
    B --> C{JWT valid?}
    C -->|No| D[Return auth error]
    C -->|Yes| E{Password correct?}
    E -->|No| F[Return invalid password]
    E -->|Yes| G{Confirmation text correct?}
    G -->|No| H[Return confirmation error]
    G -->|Yes| I[Set status to pending_deletion]
    I --> J[Set pending_deletion_at timestamp]
    J --> K[Revoke all sessions]
    K --> L[Log audit trail]
    L --> M[Return success with grace period info]
    
    M --> N[15-day grace period]
    N --> O{User logs in during grace?}
    O -->|Yes| P[Reactivate account]
    O -->|No| Q[Automated deletion job runs]
    Q --> R[Permanently delete user data]
    R --> S[Log deletion audit]
    
    style A fill:#e1f5fe
    style M,P fill:#c8e6c9
    style R fill:#ff9800
    style D,F,H fill:#ffcdd2
```

## 8. Admin User Management Flow

```mermaid
flowchart TD
    A[Admin accesses user management] --> B[GET /admin/users]
    B --> C{Admin JWT valid?}
    C -->|No| D[Return auth error]
    C -->|Yes| E{Admin role verified?}
    E -->|No| F[Return permission error]
    E -->|Yes| G[Apply filters & pagination]
    G --> H[Decrypt user data]
    H --> I[Sanitize for admin view]
    I --> J[Return user list]
    
    J --> K[Admin selects user action]
    K --> L{Action type?}
    L -->|Suspend| M[POST /admin/users/:id/suspend]
    L -->|Verify| N[POST /admin/users/:id/verify]
    L -->|View Details| O[GET /admin/users/:id]
    
    M --> P[Validate suspension data]
    P --> Q[Update user status]
    Q --> R[Revoke user sessions]
    R --> S[Log admin action]
    S --> T[Return success]
    
    style A fill:#e1f5fe
    style J,T fill:#c8e6c9
    style D,F fill:#ffcdd2
```

## 9. File Upload Flow

```mermaid
flowchart TD
    A[User selects image] --> B[Validate file locally]
    B --> C{File valid?}
    C -->|No| D[Show validation error]
    C -->|Yes| E[POST /user/avatar or /user/cover-photo]
    E --> F{JWT valid?}
    F -->|No| G[Return auth error]
    F -->|Yes| H[Validate file server-side]
    H --> I{File valid?}
    I -->|No| J[Return file error]
    I -->|Yes| K[Generate unique filename]
    K --> L[Upload to cloud storage<br/>(Alibaba OSS)]
    L --> M{Upload successful?}
    M -->|No| N[Return upload error]
    M -->|Yes| O[Update user record with URL]
    O --> P[Log audit trail]
    P --> Q[Return image URL]
    
    style A fill:#e1f5fe
    style Q fill:#c8e6c9
    style D,G,J,N fill:#ffcdd2
```

## 10. Settings Update Flow

```mermaid
flowchart TD
    A[User modifies settings] --> B[PUT /user/settings]
    B --> C{JWT valid?}
    C -->|No| D[Return auth error]
    C -->|Yes| E[Validate settings data]
    E --> F{Validation passed?}
    F -->|No| G[Return validation errors]
    F -->|Yes| H[Get current settings]
    H --> I[Merge with updates]
    I --> J{Category-specific validation?}
    J -->|Privacy| K[Validate privacy settings]
    J -->|Security| L[Validate security settings]
    J -->|Display| M[Validate display settings]
    J -->|Notifications| N[Validate notification settings]
    J -->|Content| O[Validate content settings]
    
    K --> P[Update privacy_settings]
    L --> Q[Update security_settings]
    M --> R[Update display_settings]
    N --> S[Update notification_settings]
    O --> T[Update content_settings]
    
    P --> U[Save to database]
    Q --> U
    R --> U
    S --> U
    T --> U
    U --> V[Log audit trail]
    V --> W[Return success]
    
    style A fill:#e1f5fe
    style W fill:#c8e6c9
    style D,G fill:#ffcdd2
```

## 11. Token Refresh Flow

```mermaid
flowchart TD
    A[Access token expires] --> B[POST /auth/refresh]
    B --> C{Refresh token provided?}
    C -->|No| D[Return missing token error]
    C -->|Yes| E[Verify refresh token]
    E --> F{Token valid?}
    F -->|No| G[Return invalid token error]
    F -->|Yes| H{Session exists?}
    H -->|No| I[Return session error]
    H -->|Yes| J{Session valid?}
    J -->|No| K[Return session expired error]
    J -->|Yes| L[Generate new access token]
    L --> M[Update session with new refresh token]
    M --> N[Return new tokens]
    
    style A fill:#e1f5fe
    style N fill:#c8e6c9
    style D,G,I,K fill:#ffcdd2
```

## 12. OTP Verification Flow

```mermaid
flowchart TD
    A[OTP request received] --> B{Rate limit check}
    B -->|Exceeded| C[Return rate limit error]
    B -->|OK| D[Find OTP record by verification_id]
    D --> E{OTP record exists?}
    E -->|No| F[Return invalid verification_id]
    E -->|Yes| G{OTP expired?}
    G -->|Yes| H[Return expired OTP error]
    G -->|No| I{Max attempts reached?}
    I -->|Yes| J[Return max attempts error]
    I -->|No| K{OTP code matches?}
    K -->|No| L[Increment attempts]
    L --> M[Return invalid OTP with remaining attempts]
    K -->|Yes| N[Mark OTP as verified]
    N --> O[Set verified_at timestamp]
    O --> P[Return verification success]
    
    style A fill:#e1f5fe
    style P fill:#c8e6c9
    style C,F,H,J,M fill:#ffcdd2
```
## 13. Public User Profile Viewing Flow

```mermaid
flowchart TD
    A[User taps on profile] --> B[GET /users/public/:userId]
    B --> C{User exists?}
    C -->|No| D[Return 404 User not found]
    C -->|Yes| E{User account active?}
    E -->|No| F[Return 404 User not found]
    E -->|Yes| G[Decrypt user data]
    G --> H{User profile private?}
    H -->|Yes| I[Return minimal profile data]
    H -->|No| J[Return full public profile data]
    I --> K[Log profile access]
    J --> K
    K --> L[Return sanitized profile]
    
    style A fill:#e1f5fe
    style L fill:#c8e6c9
    style D,F fill:#ffcdd2
```

## 14. Admin Audit Log Flow

```mermaid
flowchart TD
    A[Admin requests audit logs] --> B[GET /admin/audit-logs]
    B --> C{Admin JWT valid?}
    C -->|No| D[Return auth error]
    C -->|Yes| E{Admin role verified?}
    E -->|No| F[Return permission error]
    E -->|Yes| G[Parse query filters]
    G --> H[Build database query]
    H --> I[Apply date range filter]
    I --> J[Apply user_id filter]
    J --> K[Apply action filter]
    K --> L[Apply resource filter]
    L --> M[Execute paginated query]
    M --> N[Sanitize sensitive data]
    N --> O[Include user information]
    O --> P[Log admin access]
    P --> Q[Return audit logs]
    
    style A fill:#e1f5fe
    style Q fill:#c8e6c9
    style D,F fill:#ffcdd2
```

## 15. Compliance Report Generation Flow

```mermaid
flowchart TD
    A[Admin requests compliance report] --> B[POST /admin/compliance/report]
    B --> C{Admin JWT valid?}
    C -->|No| D[Return auth error]
    C -->|Yes| E{Report type valid?}
    E -->|No| F[Return invalid type error]
    E -->|Yes| G{Date range valid?}
    G -->|No| H[Return date error]
    G -->|Yes| I{Report type?}
    
    I -->|PIPL| J[Generate PIPL report]
    I -->|Cybersecurity| K[Generate Cybersecurity report]
    I -->|Data Security| L[Generate Data Security report]
    I -->|Full| M[Generate Full report]
    
    J --> N[Query data processing activities]
    K --> O[Query security incidents]
    L --> P[Query data classification activities]
    M --> Q[Combine all report types]
    
    N --> R[Calculate compliance metrics]
    O --> R
    P --> R
    Q --> R
    R --> S[Generate report ID]
    S --> T[Log report generation]
    T --> U[Return report data]
    
    style A fill:#e1f5fe
    style U fill:#c8e6c9
    style D,F,H fill:#ffcdd2
```

## 16. Data Export Flow

```mermaid
flowchart TD
    A[Data export requested] --> B[GET /admin/users/:userId/data-export]
    B --> C{Admin JWT valid?}
    C -->|No| D[Return auth error]
    C -->|Yes| E{User exists?}
    E -->|No| F[Return user not found]
    E -->|Yes| G[Decrypt user data]
    G --> H[Get audit trail]
    H --> I[Get session history]
    I --> J[Get settings data]
    J --> K[Sanitize sensitive data]
    K --> L[Format data for export]
    L --> M{Export format?}
    M -->|JSON| N[Generate JSON export]
    M -->|CSV| O[Generate CSV export]
    N --> P[Generate export ID]
    O --> P
    P --> Q[Log data export action]
    Q --> R[Return export data]
    
    style A fill:#e1f5fe
    style R fill:#c8e6c9
    style D,F fill:#ffcdd2
```



## 17. Rate Limiting Flow

```mermaid
flowchart TD
    A[API request received] --> B[Identify rate limit key]
    B --> C{Key type?}
    C -->|IP| D[Use IP address]
    C -->|User| E[Use user ID]
    C -->|Phone| F[Use phone number]
    C -->|Combined| G[Use IP + identifier]
    
    D --> H[Check Redis counter]
    E --> H
    F --> H
    G --> H
    
    H --> I{Counter exists?}
    I -->|No| J[Create new counter]
    I -->|Yes| K[Get current count]
    K --> L{Limit exceeded?}
    L -->|Yes| M[Return rate limit error]
    L -->|No| N[Increment counter]
    J --> N
    N --> O[Set/update TTL]
    O --> P[Continue to endpoint]
    
    style A fill:#e1f5fe
    style P fill:#c8e6c9
    style M fill:#ffcdd2
```

## 18. Encryption/Decryption Flow

```mermaid
flowchart TD
    A[Data processing request] --> B{Operation type?}
    B -->|Store| C[Encrypt sensitive fields]
    B -->|Retrieve| D[Decrypt sensitive fields]
    
    C --> E[Identify encrypted fields]
    E --> F[Generate IV for each field]
    F --> G[Encrypt with AES-256-GCM]
    G --> H[Generate auth tag]
    H --> I[Store encrypted data + metadata]
    
    D --> J[Identify encrypted fields]
    J --> K[Extract IV and auth tag]
    K --> L[Decrypt with AES-256-GCM]
    L --> M[Verify auth tag]
    M --> N{Decryption successful?}
    N -->|No| O[Log decryption error]
    N -->|Yes| P[Return decrypted data]
    O --> Q[Return original data]
    
    style A fill:#e1f5fe
    style I,P fill:#c8e6c9
    style O fill:#ffcdd2
```

## 19. Session Cleanup Job Flow

```mermaid
flowchart TD
    A[Scheduled job runs<br/>Every hour] --> B[Query expired sessions]
    B --> C{Expired sessions found?}
    C -->|No| D[Log no cleanup needed]
    C -->|Yes| E[Mark sessions as inactive]
    E --> F[Update revoked_at timestamp]
    F --> G[Count cleaned sessions]
    G --> H[Log cleanup results]
    H --> I[Update metrics]
    
    style A fill:#e1f5fe
    style D,I fill:#c8e6c9
```

## 20. Account Deletion Job Flow

```mermaid
flowchart TD
    A[Daily job runs<br/>3 AM] --> B[Calculate cutoff date<br/>15 days ago]
    B --> C[Query pending deletion users<br/>past grace period]
    C --> D{Users found?}
    D -->|No| E[Log no deletions needed]
    D -->|Yes| F[Start transaction]
    F --> G[Log deletion audit]
    G --> H[Delete user record<br/>CASCADE deletes related data]
    H --> I[Commit transaction]
    I --> J[Log successful deletion]
    J --> K[Continue to next user]
    K --> L{More users?}
    L -->|Yes| F
    L -->|No| M[Log job completion]
    
    style A fill:#e1f5fe
    style E,M fill:#c8e6c9
    style H fill:#ff9800
```

## 21. Security Event Detection Flow

```mermaid
flowchart TD
    A[User action occurs] --> B[Audit middleware intercepts]
    B --> C{Security-relevant action?}
    C -->|No| D[Log normal audit]
    C -->|Yes| E{Action type?}
    E -->|Failed login| F[Check failed attempt count]
    E -->|Suspicious pattern| G[Analyze request pattern]
    E -->|Admin action| H[Log admin security event]
    
    F --> I{Max attempts reached?}
    I -->|Yes| J[Lock account]
    I -->|No| K[Log failed attempt]
    
    G --> L{Pattern suspicious?}
    L -->|Yes| M[Log security alert]
    L -->|No| N[Log normal event]
    
    J --> O[Send security notification]
    K --> P[Continue processing]
    M --> O
    H --> P
    N --> P
    
    O --> Q[Update security metrics]
    P --> R[Complete request]
    
    style A fill:#e1f5fe
    style R fill:#c8e6c9
    style J,O fill:#ff9800
```

These flowcharts provide visual representations of the key processes in the Lianxin User Service, showing decision points, error handling, and the flow of data through the system. Each flowchart corresponds to major API workflows and can be used for understanding system behavior, debugging, and onboarding new developers.