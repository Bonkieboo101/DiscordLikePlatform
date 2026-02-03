import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { findOrCreateGoogleUser } from '../services/auth.service';

const clientID = process.env.GOOGLE_CLIENT_ID || '';
const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
const callbackURL = process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback';

passport.use(
  new GoogleStrategy(
    {
      clientID,
      clientSecret,
      callbackURL
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const googleId = profile.id;
        const email = profile.emails && profile.emails[0]?.value;
        const name = profile.displayName;
        const avatar = profile.photos && profile.photos[0]?.value;
        const user = await findOrCreateGoogleUser(googleId, email, name, avatar);
        done(null, user);
      } catch (err) {
        done(err as any, undefined);
      }
    }
  )
);

export default passport;
