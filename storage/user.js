const users = new Map(); // Map<id, user>
let idCounter = 1;

/*
User structure:
{
  id: Number,
  name: String,
  email: String,
  password: String (hashed),
  role: 'PATIENT'|'DOCTOR',
  status: 'ONLINE'|'BUSY'|'OFFLINE'
}
*/

async function addUser({ name, email, password, role, status }) {
  const id = idCounter++;
  const user = { id, name, email, password, role, status };
  users.set(id, user);
  return user;
}

async function getUserByEmail(email) {
  for (const u of users.values()) if (u.email === email) return u;
  return null;
}

async function getUserById(id) {
  if (users.has(Number(id))) return users.get(Number(id));
  return null;
}

async function getDoctors() {
  return Array.from(users.values()).filter(u => u.role === 'DOCTOR');
}

async function updateUserStatus(id, status) {
  const key = Number(id);
  const u = users.get(key);
  if (!u) return null;
  u.status = status;
  users.set(key, u);

  return u;
}

function getAllUsersPublic() {
  return Array.from(users.values()).map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status
  }));
}

module.exports = {
  addUser,
  getUserByEmail,
  getUserById,
  getDoctors,
  updateUserStatus,
  getAllUsersPublic,
};
