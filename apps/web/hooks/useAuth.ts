import { useAtomValue } from 'jotai';
import { atomWithQuery } from 'jotai-tanstack-query';
import { importSPKI, jwtVerify } from 'jose';

const JWT_PREFIX = 'http:cheda.kr/';

type PrefixRoot<TPrefix extends string, TValue extends { [k: string]: any }> = {
  [k in keyof TValue as k extends string ? `${TPrefix}${k}` : never]: TValue[k];
};

type SessionPayload = PrefixRoot<typeof JWT_PREFIX, {
  user: {
    userId: string;
    userName: string;
    userImage: string;
    accessToken: string;
  };
}>;

type SecuredSessionPayload = PrefixRoot<typeof JWT_PREFIX, {
  user: {
    refreshToken: string;
  };
}>;

type StatePayload = PrefixRoot<typeof JWT_PREFIX, {
  state: {
    id: string;
    url: string;
  };
}>;

type Auth = {
  loggedIn: false;
  user: null;
} | {
  loggedIn: true;
  user: {
    userId: string;
    userName: string;
    userImage: string;
  };
};

const authAtom = atomWithQuery<Auth>(() => ({
  queryKey: ['auth'],
  queryFn: async () => {
    const sessionId = document.cookie
      .split('; ')
      .find((cookie) => cookie.startsWith('session_id='))
      ?.match(/^([^=]+)=(.*)/)
      ?.[2];

    try {
      const publicKey = await importSPKI(process.env.NEXT_PUBLIC_JWT_KEY!, 'ES256');
      const token = await jwtVerify<SessionPayload>(sessionId ?? '', publicKey);

      return {
        loggedIn: true,
        user: token.payload['http:cheda.kr/user'],
      };
    } catch (e) {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_ORIGIN}/services/auth/v1/me`, {
        credentials: 'include',
      });

      if (!response.ok) {
        return {
          loggedIn: false,
          user: null,
        };
      }

      const result = await response.json();

      return {
        loggedIn: true,
        user: {
          userId: result.id,
          userName: result.name,
          userImage: result.image,
        },
      };
    }
  },
}));

export default function useAuth() {
  return useAtomValue(authAtom);
}

