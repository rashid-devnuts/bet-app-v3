import mongoose from 'mongoose';

const leagueMappingSchema = new mongoose.Schema({
    unibetId: {
        type: Number,
        required: true,
        unique: true,
        index: true
    },
    unibetName: {
        type: String,
        required: true
    },
    fotmobId: {
        type: Number,
        required: true,
        unique: true,
        index: true
    },
    fotmobName: {
        type: String,
        required: true
    },
    matchType: {
        type: String,
        enum: ['Exact Match', 'Different Name'],
        required: true
    },
    country: {
        type: String,
        default: ''
    },
    unibetUrl: {
        type: String,
        default: ''
    },
    fotmobUrl: {
        type: String,
        default: ''
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update timestamp on save
leagueMappingSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Compound index to prevent duplicate combinations
leagueMappingSchema.index({ unibetId: 1, fotmobId: 1 }, { unique: true });

const LeagueMapping = mongoose.model('LeagueMapping', leagueMappingSchema);

export default LeagueMapping;
