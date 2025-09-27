/**
 * Authentication Controller
 * HTTP layer for authentication operations
 */
class AuthController {
  constructor(authenticationApplicationService) {
    this.authService = authenticationApplicationService;
  }

  /**
   * Request registration OTP
   */
  async requestRegistrationOtp(req, res, next) {
    try {
      const { phone, country_code } = req.body;

      const result = await this.authService.requestRegistrationOtp(phone, country_code);

      res.status(200).json({
        success: true,
        data: result,
        message: 'OTP sent successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Register user
   */
  async register(req, res, next) {
    try {
      const {
        phone,
        country_code,
        password,
        verification_id,
        otp_code,
        device_id,
        device_type,
        device_name
      } = req.body;

      const deviceInfo = { device_id, device_type, device_name };
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      const result = await this.authService.registerUser({
        phone,
        countryCode: country_code,
        password,
        verificationId: verification_id,
        otpCode: otp_code,
        deviceInfo,
        ipAddress,
        userAgent
      });

      res.status(201).json({
        success: true,
        data: {
          user: result.user.toSafeView(),
          session: result.session.toSafeView()
        },
        message: 'Registration successful'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Request login OTP
   */
  async requestLoginOtp(req, res, next) {
    try {
      const { phone, country_code } = req.body;

      const result = await this.authService.requestLoginOtp(phone, country_code);

      res.status(200).json({
        success: true,
        data: result,
        message: 'OTP sent successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Login user
   */
  async login(req, res, next) {
    try {
      const {
        phone,
        country_code,
        password,
        verification_id,
        otp_code,
        device_id,
        device_type,
        device_name
      } = req.body;

      const deviceInfo = { device_id, device_type, device_name };
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      const result = await this.authService.loginUser({
        phone,
        countryCode: country_code,
        password,
        verificationId: verification_id,
        otpCode: otp_code,
        deviceInfo,
        ipAddress,
        userAgent
      });

      res.status(200).json({
        success: true,
        data: {
          user: result.user.toSafeView(),
          session: result.session.toSafeView()
        },
        message: 'Login successful'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Refresh token
   */
  async refreshToken(req, res, next) {
    try {
      const { refresh_token } = req.body;

      const result = await this.authService.refreshToken(refresh_token);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Token refreshed successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Logout user
   */
  async logout(req, res, next) {
    try {
      const authHeader = req.get('Authorization');
      const token = authHeader?.replace('Bearer ', '');

      if (!token) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_TOKEN', message: 'Access token is required' }
        });
      }

      await this.authService.logout(token);

      res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Request password reset OTP
   */
  async requestPasswordResetOtp(req, res, next) {
    try {
      const { phone, country_code } = req.body;

      const result = await this.authService.requestPasswordResetOtp(phone, country_code);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Password reset OTP sent successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Reset password
   */
  async resetPassword(req, res, next) {
    try {
      const {
        phone,
        country_code,
        verification_id,
        otp_code,
        new_password
      } = req.body;

      await this.authService.resetPassword(
        phone,
        country_code,
        verification_id,
        otp_code,
        new_password
      );

      res.status(200).json({
        success: true,
        message: 'Password reset successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify token (for middleware)
   */
  async verifyToken(req, res, next) {
    try {
      const authHeader = req.get('Authorization');
      const token = authHeader?.replace('Bearer ', '');

      if (!token) {
        return res.status(401).json({
          success: false,
          error: { code: 'MISSING_TOKEN', message: 'Access token is required' }
        });
      }

      const result = await this.authService.verifyToken(token);

      res.status(200).json({
        success: true,
        data: { user: result },
        message: 'Token verified successfully'
      });

    } catch (error) {
      next(error);
    }
  }
}

module.exports = AuthController;