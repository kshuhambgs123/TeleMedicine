module.exports = (sequelize, DataTypes) => {
    const User = sequelize.define( "users" , {
        id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
        },
        name: { type: DataTypes.STRING, allowNull: false },
        userName: {
            type: DataTypes.STRING,
            allowNull: false
        },
        email: {
            type: DataTypes.STRING,
            unique: true,
            isEmail: true, // check for email format
            allowNull: false
        },
        password:{
            type: DataTypes.STRING,
            allowNull: false
        },
        role: { // 'PATIENT' | 'DOCTOR'
            type: DataTypes.ENUM('PATIENT', 'DOCTOR'),
            allowNull: false
        },
        status: { // doctor's availability
            type: DataTypes.ENUM('ONLINE', 'BUSY', 'OFFLINE'),
            allowNull: false,
            defaultValue: 'OFFLINE'
        }
    },{ timestamps: true}, )
        return User
}