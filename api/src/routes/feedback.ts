import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getPool } from "../db/client.js";

const router = Router();

// GET /api/feedback/summary — false-positive flag counts by rule (last 30 days)
// Compliance role only; used to drive the rule-refinement backlog.
router.get(
  "/summary",
  requireAuth(["compliance"]),
  async (_req, res): Promise<void> => {
    try {
      const result = await getPool().query<{ rule_id: string; flag_count: string }>(`
        SELECT rule_id, COUNT(*) AS flag_count
        FROM false_positive_flags, unnest(rule_ids) AS rule_id
        WHERE flagged_at > NOW() - INTERVAL '30 days'
        GROUP BY rule_id
        ORDER BY flag_count DESC
        LIMIT 50
      `);
      res.json({
        data: result.rows.map((r) => ({
          ruleId: r.rule_id,
          flagCount: parseInt(r.flag_count, 10),
        })),
      });
    } catch (err) {
      process.stderr.write(
        JSON.stringify({ level: "error", event: "feedback_summary_error", error: String(err) }) + "\n",
      );
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

export { router as feedbackRouter };
