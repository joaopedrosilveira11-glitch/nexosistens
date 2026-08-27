import assert from 'node:assert/strict'
import test from 'node:test'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { authorize, authenticate } from './auth.js'
import { createSession } from '../services/sessionStore.js'
import { requireTenantScope } from './tenant.js'

test('authenticate accepts a valid JWT-backed session', () => {
  const sessionId = createSession({ sub: 'user-1', companyId: 'company-1', role: 'owner' }, 60)
  const token = jwt.sign(
    {
      sub: 'user-1',
      email: 'owner@nexo.test',
      role: 'owner',
      companyId: 'company-1',
      sessionId,
    },
    env.jwtSecret,
    { expiresIn: '1h' },
  )

  const req: any = {
    headers: { authorization: `Bearer ${token}` },
  }
  const res: any = {
    status: () => ({ json: () => ({}) }),
  }
  let nextCalled = false

  authenticate(req, res, () => {
    nextCalled = true
  })

  assert.equal(nextCalled, true)
  assert.equal(req.user.role, 'owner')
  assert.equal(req.user.companyId, 'company-1')
  assert.equal(req.sessionId, sessionId)
})

test('authenticate rejects a token whose session is not registered', () => {
  const token = jwt.sign(
    {
      sub: 'ghost-user',
      email: 'ghost@nexo.test',
      role: 'admin',
      companyId: 'company-9',
      sessionId: 'missing-session',
    },
    env.jwtSecret,
    { expiresIn: '1h' },
  )

  const req: any = {
    headers: { authorization: `Bearer ${token}` },
  }
  const res: any = {
    status(code: number) {
      this.code = code
      return this
    },
    json(payload: unknown) {
      this.payload = payload
      return payload
    },
  }

  authenticate(req, res, () => {
    throw new Error('next should not be called for invalid session')
  })

  assert.equal(res.code, 401)
  assert.equal(res.payload.error, 'Session is invalid or expired.')
})

test('authorize denies access when role or plan is insufficient', () => {
  const req: any = {
    user: {
      sub: 'employee-1',
      email: 'employee@nexo.test',
      role: 'employee',
      companyId: 'company-1',
      plan: 'Starter',
    },
  }

  const res: any = {
    status(code: number) {
      this.code = code
      return this
    },
    json(payload: unknown) {
      this.payload = payload
      return payload
    },
  }
  let nextCalled = false

  authorize(['owner', 'admin'], { module: 'employees', plans: ['Enterprise'] })(req, res, () => {
    nextCalled = true
  })

  assert.equal(res.code, 403)
  assert.equal(nextCalled, false)
})

test('authorize allows valid role and plan for a protected module', () => {
  const req: any = {
    user: {
      sub: 'owner-1',
      email: 'owner@nexo.test',
      role: 'owner',
      companyId: 'company-1',
      plan: 'Enterprise',
    },
  }

  const res: any = {
    status(code: number) {
      this.code = code
      return this
    },
    json(payload: unknown) {
      this.payload = payload
      return payload
    },
  }
  let nextCalled = false

  authorize(['owner', 'admin'], { module: 'employees', plans: ['Enterprise'] })(req, res, () => {
    nextCalled = true
  })

  assert.equal(nextCalled, true)
  assert.equal(res.code, undefined)
})

test('requireTenantScope blocks requests from another tenant', () => {
  const req: any = {
    params: { companyId: 'company-2' },
    user: { companyId: 'company-1' },
    body: {},
    query: {},
  }

  const res: any = {
    status(code: number) {
      this.code = code
      return this
    },
    json(payload: unknown) {
      this.payload = payload
      return payload
    },
  }
  let nextCalled = false

  requireTenantScope(req, res, () => {
    nextCalled = true
  })

  assert.equal(res.code, 403)
  assert.equal(nextCalled, false)
  assert.equal(res.payload.error, 'Access denied: tenant mismatch detected.')
})
