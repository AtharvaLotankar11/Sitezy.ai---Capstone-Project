import firebaseService from "./services/firebaseService.js";

/**
 * Diagnosing Agent - Infrastructure Reliability Engineer
 * Monitors, diagnoses, and attempts to fix Firebase deployment issues
 */
class DiagnosingAgent {
    constructor() {
        this.name = "DiagnosingAgent";
        this.role = "Infrastructure Reliability Engineer";
        this.capabilities = [
            "Monitor deployment logs",
            "Detect Firebase errors",
            "Check quota usage",
            "Diagnose misconfigurations",
            "Suggest remediation steps",
            "Prevent cross-tenant leakage",
            "Validate security rules",
        ];

        // Error classification system
        this.errorTypes = {
            QUOTA_EXCEEDED: {
                severity: "high",
                autoFix: false,
                remediation: "Upgrade Firebase plan or optimize queries",
            },
            PERMISSION_DENIED: {
                severity: "critical",
                autoFix: false,
                remediation: "Check Firestore security rules and service account permissions",
            },
            NETWORK_ERROR: {
                severity: "medium",
                autoFix: true,
                remediation: "Retry deployment with exponential backoff",
            },
            INVALID_CREDENTIALS: {
                severity: "critical",
                autoFix: false,
                remediation: "Verify Firebase service account credentials in .env",
            },
            TENANT_ISOLATION_BREACH: {
                severity: "critical",
                autoFix: false,
                remediation: "Immediate investigation required - potential security breach",
            },
            DEPLOYMENT_TIMEOUT: {
                severity: "medium",
                autoFix: true,
                remediation: "Retry with smaller batch size",
            },
            STORAGE_LIMIT: {
                severity: "high",
                autoFix: false,
                remediation: "Clean up old assets or upgrade storage plan",
            },
        };
    }

    /**
     * Main diagnostic execution
     * @param {Object} deploymentResult - Result from FirebaseAgent
     * @param {Object} context - Additional context
     */
    async execute(deploymentResult, context = {}) {
        console.log(`🔍 [${this.name}] Starting diagnostic analysis`);

        const diagnosis = {
            agent: this.name,
            timestamp: new Date().toISOString(),
            deploymentId: deploymentResult.deploymentId,
            tenantId: deploymentResult.tenantId,
            siteId: deploymentResult.siteId,
            analysis: [],
            recommendations: [],
            autoFixAttempted: false,
            autoFixSuccess: false,
            severity: "none",
        };

        try {
            // Step 1: Analyze deployment result
            diagnosis.analysis.push(await this.analyzeDeploymentResult(deploymentResult));

            // Step 2: Check for errors
            if (deploymentResult.error) {
                diagnosis.analysis.push(await this.classifyError(deploymentResult.error));
            }

            // Step 3: Validate tenant isolation
            diagnosis.analysis.push(
                await this.validateTenantIsolation(deploymentResult.tenantId, deploymentResult.siteId)
            );

            // Step 4: Check quota usage
            diagnosis.analysis.push(await this.checkQuotaUsage());

            // Step 5: Validate security configuration
            diagnosis.analysis.push(await this.validateSecurityConfiguration(deploymentResult.tenantId));

            // Step 6: Generate recommendations
            diagnosis.recommendations = this.generateRecommendations(diagnosis.analysis);

            // Step 7: Attempt auto-fix if applicable
            if (this.shouldAttemptAutoFix(diagnosis)) {
                diagnosis.autoFixAttempted = true;
                const fixResult = await this.attemptAutoFix(deploymentResult, diagnosis);
                diagnosis.autoFixSuccess = fixResult.success;
                diagnosis.autoFixDetails = fixResult;
            }

            // Determine overall severity
            diagnosis.severity = this.calculateSeverity(diagnosis.analysis);

            console.log(`✅ [${this.name}] Diagnostic complete - Severity: ${diagnosis.severity}`);
            return diagnosis;
        } catch (error) {
            console.error(`❌ [${this.name}] Diagnostic failed:`, error.message);
            diagnosis.diagnosticError = error.message;
            return diagnosis;
        }
    }

    /**
     * Analyze deployment result
     */
    async analyzeDeploymentResult(result) {
        const analysis = {
            check: "deployment_result_analysis",
            status: result.success ? "pass" : "fail",
            details: {},
        };

        if (result.success) {
            analysis.details = {
                message: "Deployment completed successfully",
                stepsCompleted: result.steps?.length || 0,
                hostingUrl: result.hostingUrl,
            };
        } else {
            analysis.details = {
                message: "Deployment failed",
                error: result.error?.message,
                failedStep: this.identifyFailedStep(result.steps),
            };
        }

        return analysis;
    }

    /**
     * Classify error type
     */
    async classifyError(error) {
        const errorMessage = error.message?.toLowerCase() || "";
        let errorType = "UNKNOWN_ERROR";

        // Pattern matching for error classification
        if (errorMessage.includes("quota") || errorMessage.includes("limit exceeded")) {
            errorType = "QUOTA_EXCEEDED";
        } else if (errorMessage.includes("permission") || errorMessage.includes("forbidden")) {
            errorType = "PERMISSION_DENIED";
        } else if (errorMessage.includes("network") || errorMessage.includes("econnrefused")) {
            errorType = "NETWORK_ERROR";
        } else if (errorMessage.includes("credential") || errorMessage.includes("authentication")) {
            errorType = "INVALID_CREDENTIALS";
        } else if (errorMessage.includes("timeout")) {
            errorType = "DEPLOYMENT_TIMEOUT";
        } else if (errorMessage.includes("storage")) {
            errorType = "STORAGE_LIMIT";
        }

        const classification = this.errorTypes[errorType] || {
            severity: "medium",
            autoFix: false,
            remediation: "Manual investigation required",
        };

        return {
            check: "error_classification",
            status: "fail",
            errorType,
            severity: classification.severity,
            autoFixable: classification.autoFix,
            remediation: classification.remediation,
            originalError: error.message,
        };
    }

    /**
     * Validate tenant isolation
     */
    async validateTenantIsolation(tenantId, siteId) {
        try {
            const status = await firebaseService.getDeploymentStatus(tenantId, siteId);

            if (status.exists && status.data) {
                // Verify tenant ID matches
                if (status.data.tenantId !== tenantId) {
                    return {
                        check: "tenant_isolation",
                        status: "fail",
                        severity: "critical",
                        details: "TENANT ISOLATION BREACH DETECTED",
                        remediation: "Immediate investigation required",
                    };
                }
            }

            return {
                check: "tenant_isolation",
                status: "pass",
                details: "Tenant isolation validated successfully",
            };
        } catch (error) {
            return {
                check: "tenant_isolation",
                status: "error",
                details: `Validation failed: ${error.message}`,
            };
        }
    }

    /**
     * Check Firebase quota usage
     */
    async checkQuotaUsage() {
        try {
            const quotaInfo = await firebaseService.checkQuotaUsage();
            return {
                check: "quota_usage",
                status: "info",
                details: quotaInfo,
            };
        } catch (error) {
            return {
                check: "quota_usage",
                status: "error",
                details: `Quota check failed: ${error.message}`,
            };
        }
    }

    /**
     * Validate security configuration
     */
    async validateSecurityConfiguration(tenantId) {
        try {
            const result = await firebaseService.applySecurityRules(tenantId);
            return {
                check: "security_configuration",
                status: "pass",
                details: result,
            };
        } catch (error) {
            return {
                check: "security_configuration",
                status: "fail",
                severity: "high",
                details: `Security validation failed: ${error.message}`,
            };
        }
    }

    /**
     * Generate recommendations based on analysis
     */
    generateRecommendations(analysis) {
        const recommendations = [];

        analysis.forEach((item) => {
            if (item.status === "fail" || item.status === "error") {
                recommendations.push({
                    issue: item.check,
                    severity: item.severity || "medium",
                    remediation: item.remediation || "Manual investigation required",
                    autoFixable: item.autoFixable || false,
                });
            }
        });

        // Add general recommendations
        if (recommendations.length === 0) {
            recommendations.push({
                issue: "none",
                message: "No issues detected. Deployment is healthy.",
            });
        }

        return recommendations;
    }

    /**
     * Determine if auto-fix should be attempted
     */
    shouldAttemptAutoFix(diagnosis) {
        return diagnosis.recommendations.some((rec) => rec.autoFixable === true);
    }

    /**
     * Attempt automatic fix
     */
    async attemptAutoFix(deploymentResult, diagnosis) {
        console.log(`🔧 [${this.name}] Attempting auto-fix`);

        const fixResult = {
            success: false,
            actions: [],
            message: "",
        };

        try {
            // Find auto-fixable issues
            const fixableIssues = diagnosis.recommendations.filter((rec) => rec.autoFixable);

            for (const issue of fixableIssues) {
                if (issue.issue === "error_classification") {
                    // Retry deployment for network errors or timeouts
                    fixResult.actions.push({
                        action: "retry_deployment",
                        status: "attempted",
                        message: "Deployment will be retried by orchestrator",
                    });
                }
            }

            fixResult.success = fixResult.actions.length > 0;
            fixResult.message = fixResult.success
                ? "Auto-fix actions prepared"
                : "No auto-fixable issues found";

            return fixResult;
        } catch (error) {
            fixResult.message = `Auto-fix failed: ${error.message}`;
            return fixResult;
        }
    }

    /**
     * Calculate overall severity
     */
    calculateSeverity(analysis) {
        const severities = analysis
            .filter((item) => item.severity)
            .map((item) => item.severity);

        if (severities.includes("critical")) return "critical";
        if (severities.includes("high")) return "high";
        if (severities.includes("medium")) return "medium";
        return "low";
    }

    /**
     * Identify which step failed
     */
    identifyFailedStep(steps) {
        if (!steps || steps.length === 0) return "initialization";

        const failedStep = steps.find((step) => step.status === "error" || step.status === "failed");
        return failedStep?.step || "unknown";
    }

    /**
     * Get agent status
     */
    getStatus() {
        return {
            name: this.name,
            role: this.role,
            capabilities: this.capabilities,
            errorTypes: Object.keys(this.errorTypes),
            status: "ready",
        };
    }
}

export default DiagnosingAgent;
