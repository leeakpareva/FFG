/**
 * Sweeps up throwaway accounts left by the test scripts.
 *
 * Both e2e.mjs and test-speaker.mjs clean up after themselves, but a hard kill
 * skips that, and registration is open so the abandoned Clerk account leaves a
 * members row behind too. Every test account uses an @example.com address,
 * which nobody real will ever sign up with.
 *
 *   node tests/prune-test-accounts.mjs
 *
 * Needs CLERK_SECRET_KEY. Only touches @example.com; real members are never
 * matched, and it prints what it removed rather than working silently.
 */
const CLERK_SECRET = process.env.CLERK_SECRET_KEY;
if (!CLERK_SECRET) {
  console.error('CLERK_SECRET_KEY is required.');
  process.exit(2);
}

const clerk = (path, init = {}) =>
  fetch(`https://api.clerk.com/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${CLERK_SECRET}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });

const users = await (await clerk('/users?limit=100')).json();
const strays = users.filter(u =>
  (u.email_addresses?.[0]?.email_address || '').endsWith('@example.com')
);

if (!strays.length) {
  console.log('No test accounts to remove.');
} else {
  for (const u of strays) {
    await clerk(`/users/${u.id}`, { method: 'DELETE' });
    console.log('deleted', u.email_addresses[0].email_address);
  }
  console.log(`\n${strays.length} removed.`);
}

console.log('\nThe matching members rows are not reachable over the API by design.');
console.log('Clear them on the ASUS with:');
console.log(`  docker exec ffg-postgres psql -U postgres -d ffg \\`);
console.log(`    -c "DELETE FROM members WHERE email LIKE '%@example.com';"`);
