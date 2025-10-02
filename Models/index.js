require('dotenv').config()
const { Sequelize, DataTypes } = require('sequelize')

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: process.env.DB_DIALECT,
    logging: false, // optional, disables SQL logs
  }
)

// // check if connection is done
// sequelize.authenticate()
//   .then(() => {
//     console.log(`✅ Database connected to ${process.env.DB_NAME}`)
//   })
//   .catch((err) => {
//     console.log("❌ Error connecting DB:", err)
//   })

const db = {}
db.Sequelize = Sequelize
db.sequelize = sequelize

// connecting to model
db.User = require('./user')(sequelize, DataTypes)

// ✅ Sync models with database
db.sequelize.sync({ alter: true })
  .then(() => {
    console.log("✅ Tables have been created/updated")
  })
  .catch(err => {
    console.log("❌ Error syncing database:", err)
  })

module.exports = db

