import { Router } from 'express'
import { z } from 'zod'
import { authenticate, authorize } from '../../middleware/auth.js'
import { validateBody } from '../../middleware/validation.js'

const router = Router()
const auditLogSchema = z.object({ action: z.string().min(3), resourceType: z.string().min(2), resourceId: z.string().min(1), changeSummary: z.string().min(3), origin: z.string().min(2) })
router.use(authenticate)
router.get('/', authorize(['owner', 'admin', 'manager']), (_req, res) => res.status(200).json({ logs: [] }))
router.post('/', authorize(['owner', 'admin']), validateBody(auditLogSchema), (_req, res) => res.status(501).json({ error: 'Audit persistence is not configured yet.' }))
export default router