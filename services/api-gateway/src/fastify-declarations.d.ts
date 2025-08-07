import '@fastify/jwt';
import '@fastify/oauth2';
import '@fastify/http-proxy';

declare module 'fastify' {
  interface FastifyRequest {
    jwtVerify: () => Promise<void>;
    user: {
      username: string;
      // Add other properties that your JWT payload might contain
    };
    proxy: { // Added for @fastify/http-proxy
      upstream: string;
    };
  }

  interface FastifyInstance {
    jwt: {
      sign: (payload: object) => string;
      verify: (token: string) => object;
    };
    googleOAuth2: {
      getAccessTokenFromAuthorizationCodeFlow: (request: FastifyRequest) => Promise<any>;
      // Add other methods/properties from @fastify/oauth2 if you use them
    };
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
