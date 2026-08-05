-- Members for the Clerk accounts currently testing Connect.
--
-- requireMember answers 403 to any signed-in Clerk user with no row here, so
-- a tester cannot do anything until they exist. Rows are deliberately thin:
-- name/handle/role are placeholders and each member fills in their own via
-- the profile editor. Only Lee is an admin, so only Lee can publish to Read.
--
-- `email` is what links a Clerk account to its row — it must match the address
-- they sign in with, lowercase. clerk_id is claimed automatically on first
-- sign-in and is authoritative afterwards.

INSERT INTO members (id, name, handle, role, pillar, bio, verified, email, is_admin)
VALUES
  ('LA', 'Leslie A.',  'leslie.a',  'Founder - NAVADA', 'Capital',
   'Building the technology behind FFG Digital. From access to ownership.',
   true,  'leeakpareva@gmail.com',       true),

  ('CR', 'Charlene R.', 'charlene.r', 'Member', 'Community', NULL,
   false, 'charlenegrichards@gmail.com', false),

  ('FC', 'FFG Content', 'ffg.content', 'Content', 'Community', NULL,
   false, 'ffgcontent@gmail.com',        false),

  ('CX', 'Chopstix',    'chopstix',   'Member', 'Connect',   NULL,
   false, 'send2chopstix@gmail.com',     false)

ON CONFLICT (id) DO UPDATE
  SET email    = EXCLUDED.email,
      is_admin = EXCLUDED.is_admin;
