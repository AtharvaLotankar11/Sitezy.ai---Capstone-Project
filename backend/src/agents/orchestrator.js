import FirebaseAgent from "./firebaseAgent.js";
import DiagnosingAgent from "./diagnosingAgent.js";
import DeploymentLog from "./logs/deploymentLogs.js";

/**
 * AutoGen Orchestrator - Coordinates multi-agent deployment workflow
 * Manages communication between FirebaseAgent and DiagnosingAgent
 */
class AgentOrchestrator {
    constructor() {
        this.firebaseAgent = new FirebaseAgent();
        this.diagnosingAgent = new DiagnosingAgent();
        this.maxRetries = 1; // Maximum retry attempts
        this.circuitBreakerThreshold = 5; // Failures before circuit opens
        this.circuitBreakerWindow = 300000; // 5 minutes
        this.failureHistory = new Map(); // Track failures per tenant
    }

    /**
     * Main orchestration method - coordinates deployment workflow
     * @param {Object} deploymentContext - Full deployment context
     * @returns {Object} - Complete deployment result with logs
     */
    async orchestrate(deploymentContext) {
        const {
            tenantId,
            siteId,
            websiteId,
            userId,
            websiteData,
            pages,
            assets = [],
        } = deploymentContext;

        console.log(`🎭 [Orchestrator] Starting deployment orchestration`);
        console.log(`   Tenant: ${tenantId}, Site: ${siteId}, Website: ${websiteId}`);

        // Create deployment log entry
        const deploymentLog = await DeploymentLog.create({
            tenantId,
            websiteId,
            siteId,
            deployedBy: userId,
            status: "pending",
            agentLogs: [],
        });

        const orchestrationResult = {
            deploymentId: deploymentLog._id,
            tenantId,
            siteId,
            websiteId,
            startTime: new Date().toISOString(),
            endTime: null,
            success: false,
            attempts: 0,
            agents: [],
            finalStatus: "pending",
            error: null,
        };

        try {
            // Check circuit breaker
            if (this.isCircuitOpen(tenantId)) {
                throw new Error(
                    "Circuit breaker open: Too many recent failures. Please wait before retrying."
                );
            }

            // Attempt deployment with retry logic
            let deploymentResult = null;
            let retryCount = 0;

            while (retryCount <= this.maxRetries) {
                orchestrationResult.attempts = retryCount + 1;

                console.log(`🚀 [Orchestrator] Deployment attempt ${retryCount + 1}/${this.maxRetries + 1}`);

                // Execute FirebaseAgent
                deploymentResult = await this.executeFirebaseAgent({
                    tenantId,
                    siteId,
                    websiteData,
                    pages,
                    assets,
                });

                orchestrationResult.agents.push({
                    agent: "FirebaseAgent",
                    attempt: retryCount + 1,
                    result: deploymentResult,
                });

                // Update deployment log
                await DeploymentLog.addAgentLog(deploymentLog._id, {
                    agent: "FirebaseAgent",
                    attempt: retryCount + 1,
                    timestamp: new Date().toISOString(),
                    result: deploymentResult,
                });

                // If successful, break retry loop
                if (deploymentResult.success) {
                    console.log(`✅ [Orchestrator] Deployment successful on attempt ${retryCount + 1}`);
                    break;
                }

                // If failed, execute DiagnosingAgent
                console.log(`🔍 [Orchestrator] Deployment failed, activating DiagnosingAgent`);

                const diagnosis = await this.executeDiagnosingAgent(deploymentResult, {
                    tenantId,
                    siteId,
                    attempt: retryCount + 1,
                });

                orchestrationResult.agents.push({
                    agent: "DiagnosingAgent",
                    attempt: retryCount + 1,
                    result: diagnosis,
                });

                // Update deployment log
                await DeploymentLog.addAgentLog(deploymentLog._id, {
                    agent: "DiagnosingAgent",
                    attempt: retryCount + 1,
                    timestamp: new Date().toISOString(),
                    result: diagnosis,
                });

                // Check if we should retry
                if (retryCount >= this.maxRetries) {
                    console.log(`❌ [Orchestrator] Max retries reached`);
                    break;
                }

                // Only retry if diagnosis suggests it's fixable
                if (!this.shouldRetry(diagnosis)) {
                    console.log(`⚠️ [Orchestrator] Issue not auto-fixable, stopping retries`);
                    break;
                }

                retryCount++;
                console.log(`🔄 [Orchestrator] Retrying deployment...`);

                // Wait before retry (exponential backoff)
                await this.sleep(Math.pow(2, retryCount) * 1000);
            }

            // Determine final status
            orchestrationResult.success = deploymentResult?.success || false;
            orchestrationResult.finalStatus = deploymentResult?.success ? "success" : "failed";
            orchestrationResult.endTime = new Date().toISOString();

            // Update failure history for circuit breaker
            if (!orchestrationResult.success) {
                this.recordFailure(tenantId);
            } else {
                this.clearFailures(tenantId);
            }

            // Extract deployment details
            if (deploymentResult?.success) {
                orchestrationResult.hostingUrl = deploymentResult.hostingUrl;
                orchestrationResult.firestorePath = deploymentResult.firestorePath;
            } else {
                orchestrationResult.error = deploymentResult?.error;
            }

            // Update final deployment log
            await DeploymentLog.updateStatus(
                deploymentLog._id,
                orchestrationResult.finalStatus,
                orchestrationResult
            );

            console.log(`🎭 [Orchestrator] Orchestration complete - Status: ${orchestrationResult.finalStatus}`);
            return orchestrationResult;
        } catch (error) {
            console.error(`❌ [Orchestrator] Orchestration failed:`, error.message);

            orchestrationResult.success = false;
            orchestrationResult.finalStatus = "failed";
            orchestrationResult.error = {
                message: error.message,
                stack: error.stack,
            };
            orchestrationResult.endTime = new Date().toISOString();

            // Update deployment log
            await DeploymentLog.updateStatus(deploymentLog._id, "failed", orchestrationResult);

            return orchestrationResult;
        }
    }

    /**
     * Execute FirebaseAgent
     */
    async executeFirebaseAgent(context) {
        try {
            return await this.firebaseAgent.execute(context);
        } catch (error) {
            return {
                agent: "FirebaseAgent",
                success: false,
                error: {
                    message: error.message,
                    stack: error.stack,
                },
            };
        }
    }

    /**
     * Execute DiagnosingAgent
     */
    async executeDiagnosingAgent(deploymentResult, context) {
        try {
            return await this.diagnosingAgent.execute(deploymentResult, context);
        } catch (error) {
            return {
                agent: "DiagnosingAgent",
                diagnosticError: error.message,
            };
        }
    }

    /**
     * Determine if deployment should be retried based on diagnosis
     */
    shouldRetry(diagnosis) {
        // Don't retry if severity is critical (requires manual intervention)
        if (diagnosis.severity === "critical") {
            return false;
        }

        // Retry if auto-fix was attempted or issue is network-related
        return diagnosis.autoFixAttempted || diagnosis.severity === "medium";
    }

    /**
     * Circuit breaker: Check if too many recent failures
     */
    isCircuitOpen(tenantId) {
        const failures = this.failureHistory.get(tenantId);
        if (!failures) return false;

        const recentFailures = failures.filter(
            (timestamp) => Date.now() - timestamp < this.circuitBreakerWindow
        );

        return recentFailures.length >= this.circuitBreakerThreshold;
    }

    /**
     * Record deployment failure for circuit breaker
     */
    recordFailure(tenantId) {
        if (!this.failureHistory.has(tenantId)) {
            this.failureHistory.set(tenantId, []);
        }
        this.failureHistory.get(tenantId).push(Date.now());
    }

    /**
     * Clear failure history on success
     */
    clearFailures(tenantId) {
        this.failureHistory.delete(tenantId);
    }

    /**
     * Sleep utility for retry backoff
     */
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Get orchestrator status
     */
    getStatus() {
        return {
            orchestrator: "AgentOrchestrator",
            agents: [this.firebaseAgent.getStatus(), this.diagnosingAgent.getStatus()],
            config: {
                maxRetries: this.maxRetries,
                circuitBreakerThreshold: this.circuitBreakerThreshold,
                circuitBreakerWindow: `${this.circuitBreakerWindow / 1000}s`,
            },
            status: "ready",
        };
    }
}

// Singleton instance
const orchestrator = new AgentOrchestrator();
export default orchestrator;
