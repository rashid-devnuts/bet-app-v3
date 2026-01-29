import mongoose from 'mongoose';

const failedLeagueMappingAttemptSchema = new mongoose.Schema({
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
    country: {
        type: String,
        default: ''
    },
    unibetUrl: {
        type: String,
        default: ''
    },
    mappingAttempted: {
        type: Boolean,
        default: true
    },
    mappingFailed: {
        type: Boolean,
        default: true
    },
    lastMappingAttempt: {
        type: Date,
        default: Date.now
    },
    attemptCount: {
        type: Number,
        default: 1
    },
    reason: {
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
failedLeagueMappingAttemptSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Index for querying
failedLeagueMappingAttemptSchema.index({ unibetId: 1 });
failedLeagueMappingAttemptSchema.index({ lastMappingAttempt: -1 });

const FailedLeagueMappingAttempt = mongoose.model('FailedLeagueMappingAttempt', failedLeagueMappingAttemptSchema);

export default FailedLeagueMappingAttempt;
