import mongoose from "mongoose";

const agentLogSchema = new mongoose.Schema(
    {
        agent: { type: String, required: true },
        attempt: { type: Number, default: 1 },
        timestamp: { type: String },
        result: { type: mongoose.Schema.Types.Mixed },
    },
    { _id: false }
);

const deploymentLogSchema = new mongoose.Schema(
    {
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Tenant",
            required: true,
            index: true,
        },
        websiteId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Website",
            required: true,
            index: true,
        },
        siteId: { type: String },
        deployedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        status: {
            type: String,
            enum: ["pending", "running", "success", "failed"],
            default: "pending",
        },
        agentLogs: [agentLogSchema],
        result: { type: mongoose.Schema.Types.Mixed },
        hostingUrl: { type: String },
        firestorePath: { type: String },
        error: { type: mongoose.Schema.Types.Mixed },
    },
    {
        timestamps: true,
    }
);

// Static: append an agent log entry
deploymentLogSchema.statics.addAgentLog = async function (deploymentId, logEntry) {
    return this.findByIdAndUpdate(
        deploymentId,
        {
            $push: { agentLogs: logEntry },
            $set: { status: "running" },
        },
        { new: true }
    );
};

// Static: update final status + result
deploymentLogSchema.statics.updateStatus = async function (deploymentId, status, result) {
    const update = { status };

    if (result) {
        update.result = result;
        if (result.hostingUrl) update.hostingUrl = result.hostingUrl;
        if (result.firestorePath) update.firestorePath = result.firestorePath;
        if (result.error) update.error = result.error;
    }

    return this.findByIdAndUpdate(deploymentId, { $set: update }, { new: true });
};

// Static: get recent deployment history for a tenant
deploymentLogSchema.statics.getDeploymentHistory = async function (tenantId, limit = 50) {
    return this.find({ tenantId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("deployedBy", "name email")
        .populate("websiteId", "name")
        .lean();
};

// Static: get deployment stats for a tenant over N days
deploymentLogSchema.statics.getDeploymentStats = async function (tenantId, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const stats = await this.aggregate([
        { $match: { tenantId: new mongoose.Types.ObjectId(tenantId), createdAt: { $gte: since } } },
        {
            $group: {
                _id: "$status",
                count: { $sum: 1 },
            },
        },
    ]);

    const result = { total: 0, success: 0, failed: 0, pending: 0, running: 0 };
    stats.forEach(({ _id, count }) => {
        result[_id] = count;
        result.total += count;
    });

    return result;
};

const DeploymentLog = mongoose.model("DeploymentLog", deploymentLogSchema);
export default DeploymentLog;
