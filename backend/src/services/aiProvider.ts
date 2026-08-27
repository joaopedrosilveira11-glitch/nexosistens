import OpenAI from 'openai'
import { env } from '../config/env.js'
import { logger } from '../utils/logger.js'

const localHeuristicResponse = (_question: string, _role: string, reason?: string) => ({
  answer: reason ?? 'Ainda não há dados operacionais cadastrados suficientes para responder a essa pergunta.',
  evidence: reason ? ['A conta do OpenAI precisa de quota ativa para responder a esta pergunta.'] : [],
})

function buildDomainPrompt(domain?: string) {
  const normalizedDomain = (domain ?? 'operations').toLowerCase()

  switch (normalizedDomain) {
    case 'sales':
      return 'Você atua no domínio de vendas. Foque em pipeline, conversão, propostas, faturamento, clientes, carteira, eficiência comercial, riscos de perda de negócio e ações imediatas para corrigir gargalos.'
    case 'finance':
      return 'Você atua no domínio financeiro. Foque em fluxo de caixa, receitas, contas a pagar e receber, inadimplência, margem, custos, liquidez, risco financeiro e prioridades de cobrança.'
    case 'inventory':
      return 'Você atua no domínio de estoque. Foque em disponibilidade, giro, reposição, itens críticos, ruptura, perdas, lead time e riscos de falta de material.'
    case 'operations':
    default:
      return 'Você atua no domínio operacional. Foque em produção, SLA, pendências, produtividade, gargalos, priorização e adequação de capacidade.'
  }
}

export async function generateAiAnswer(question: string, role: string, domain?: string) {
  if (!env.openAiApiKey) {
    return localHeuristicResponse(question, role)
  }

  try {
    const client = new OpenAI({ apiKey: env.openAiApiKey })
    const domainPrompt = buildDomainPrompt(domain)
    const response = await client.chat.completions.create({
      model: env.openAiModel,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: `Você é a NEXO AI, assistente da plataforma. Responda em português do Brasil, seja objetivo, baseie-se em dados operacionais reais e nunca invente fatos. Se houver dados insuficientes, diga que ainda não há dados suficientes para uma resposta confiável. ${domainPrompt} Mantenha o foco em gestão operacional, vendas, produção, estoque, financeiro, clientes e riscos.`,
        },
        {
          role: 'user',
          content: `Perfil do usuário: ${role}. Domínio principal: ${domain ?? 'operations'}. Pergunta: ${question}`,
        },
      ],
    })

    const answer = response.choices[0]?.message?.content?.trim() || 'Não foi possível gerar uma resposta com a IA no momento.'
    return {
      answer,
      evidence: ['Resposta gerada via OpenAI', `Prompt de contexto do domínio ${domain ?? 'operations'} da NEXO`, 'Baseada no perfil e na prioridade operacional atual'],
    }
  } catch (error) {
    logger.error('OpenAI AI generation failed', {
      error: error instanceof Error ? error.message : 'unknown',
      code: typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code) : undefined,
      status: typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status?: unknown }).status) : undefined,
    })

    const isQuotaError = typeof error === 'object' && error !== null && 'status' in error && error.status === 429
    const isInsufficientQuota = typeof error === 'object' && error !== null && 'code' in error && error.code === 'insufficient_quota'

    if (isQuotaError || isInsufficientQuota) {
      return localHeuristicResponse(
        question,
        role,
        'A IA operacional está configurada, mas a conta do OpenAI está sem quota ativa ou sem billing habilitado. Ative o faturamento e tente novamente.',
      )
    }

    return localHeuristicResponse(question, role)
  }
}
