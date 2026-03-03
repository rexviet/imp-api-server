import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { WsException } from '@nestjs/websockets';

@Injectable()
export class WsAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsAuthGuard.name);

  constructor(private readonly firebaseService: FirebaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client = context.switchToWs().getClient();
      const token = client.handshake?.auth?.token || client.handshake?.headers?.authorization?.split('Bearer ')[1];

      if (!token) {
        this.logger.error('No token provided for WebSocket connection');
        throw new WsException('Unauthorized');
      }

      const decodedToken = await this.firebaseService.verifyToken(token);
      if (!decodedToken) {
        this.logger.error('Invalid token provided for WebSocket connection');
        throw new WsException('Unauthorized');
      }

      // Attach user to client
      client.user = decodedToken;
      return true;
    } catch (err) {
      this.logger.error(`WS Auth Error: ${err.message}`);
      throw new WsException('Unauthorized');
    }
  }
}
