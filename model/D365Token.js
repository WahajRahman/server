import mongoose from 'mongoose';

const D365TokenSchema = new mongoose.Schema({
  ownerId: { type: String, default: 'service' },
  ownerType: { type: String, enum: ['service', 'local', 'azure'], default: 'service' },
  access_token: { type: String, required: true },
  token_type: { type: String },
  resource: { type: String },
  expires_on: { type: Number, required: true },
  expires_in: { type: Number },
}, { timestamps: true });

D365TokenSchema.index({ ownerId: 1 }, { unique: true });

export default mongoose.model('D365Token', D365TokenSchema);
