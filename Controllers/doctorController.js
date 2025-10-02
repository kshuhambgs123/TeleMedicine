// const { User } = require('../Models');
const { getUserById, updateUserStatus, getDoctors } = require('../storage/user');


// Update Doctor Status
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['ONLINE', 'BUSY', 'OFFLINE'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: 'invalid status' });
    }

    // Only doctors allowed
    if (req.user.role !== 'DOCTOR') {
      return res.status(403).json({ error: 'only doctors can change status' });
    }

    // const user = await User.findByPk(req.user.id);
    const user = await updateUserStatus(req.user.id, status);
    if (!user) return res.status(404).json({ error: 'user not found' });

    // user.status = status;
    // await user.save();

    // Broadcast update via WebSocket if broadcaster exists
    if (req.app?.locals?.wsBroadcaster) {
      req.app.locals.wsBroadcaster.broadcastUsers();
    }

    return res.json({ id: user.id, status: user.status });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};

// List All Doctors
exports.listDoctors = async (req, res) => {
  try {
    // const doctors = await User.findAll({
    //   where: { role: 'DOCTOR' },
    //   attributes: ['id', 'name', 'email', 'role', 'status'],
    // });

    const doctor = await getDoctors();
    const doctors = doctor.map(d => ({ id: d.id, name: d.name, email: d.email, role: d.role, status: d.status }));

    return res.json(doctors);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};
