const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      maxlength: 150,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password_hash: {
      type: String,
      default: null,
    },
    google_id: {
      type: String,
      default: null,
      sparse: true,
    },
    avatar_url: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: ['SUPPLY_CHAIN_MANAGER', 'WAREHOUSE_ADMIN', 'VIEWER'],
      default: 'VIEWER',
    },
    node_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Node',
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// Virtual "id" field so code using user.id keeps working
userSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('User', userSchema);
