import { Router } from 'express'
import { z } from 'zod'
import { authenticate, authorize } from '../../middleware/auth.js'
import { validateBody } from '../../middleware/validation.js'
import { generateAiAnswer } from '../../services/aiProvider.js'
import { env } from '../../config/env.js'

const router = Router()

const chatSchema = z.object({
  question: z.string().min(3),
  plan: z.enum(['Starter', 'Growth', 'Pro', 'Enterprise']).optional(),
  context: z.object({
    domain: z.enum(['sales', 'finance', 'operations', 'inventory']).optional(),
  }).optional(),
})

router.post('/chat', validateBody(chatSchema), async (req, res) => {
  const requestedPlan = String(req.body.plan ?? req.headers['x-plan'] ?? 'Pro').toLowerCase()
  const isAiPlanEnabled = ['pro', 'enterprise'].includes(requestedPlan)

  if (!isAiPlanEnabled) {
    return res.status(403).json({
      error: 'A IA operacional está disponível apenas nos planos Pro e Enterprise.',
    })
  }

  const respond = async () => {
    const userRole = req.user?.role ?? 'owner'
    const domain = req.body.context?.domain ?? 'operations'
    const response = await generateAiAnswer(req.body.question, userRole, domain)

    return res.status(200).json({
      answer: response.answer,
      evidence: response.evidence,
      question: req.body.question,
      plan: requestedPlan,
    })
  }

  if (env.nodeEnv === 'production') {
    return authenticate(req, res, () => {
      const authMiddleware = authorize(['owner', 'admin', 'manager', 'employee'])
      return authMiddleware(req, res, respond)
    })
  }

  return respond()
})

export default router
