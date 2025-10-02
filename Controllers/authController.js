const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
// const { User } = require('../Models/user');
require('dotenv').config();
const { addUser, getUserByEmail } = require('../storage/user');

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

// REGISTER CONTROLLER
exports.registerUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'name,email,password,role required' });
    }
    if (!['PATIENT', 'DOCTOR'].includes(role)) {
      return res.status(400).json({ error: 'role must be PATIENT or DOCTOR' });
    }

    // const existing = await User.findOne({ where: { email } });
    const existing = await getUserByEmail(email);
    if (existing) return res.status(400).json({ error: 'email already used' });

    if (existing) return res.status(400).json({ error: 'email already used' });

    const hashed = await bcrypt.hash(password, 10);
    // const user = await User.create({
    //   name,
    //   email,
    //   password: hashed,
    //   role,
    //   status: role === 'DOCTOR' ? 'ONLINE' : 'OFFLINE',
    // });

    const user = await addUser({
      name,
      email,
      password: hashed,
      role,
      status: role === 'DOCTOR' ? 'ONLINE' : 'OFFLINE'
    });

    if(user) {
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '12h' }
        );
        res.cookie("jwt", token, { maxAge: 1 * 12 * 60 * 60, httpOnly: true });
    }

    return res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};

// LOGIN CONTROLLER
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'email and password required' });

    // const user = await User.findOne({ where: { email } });
    const user = await getUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'invalid credentials' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    //go ahead and generate a cookie for the user
    res.cookie("jwt", token, { maxAge: 1 * 12 * 60 * 60, httpOnly: true });
   

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};
