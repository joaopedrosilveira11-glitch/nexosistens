export const dashboardService = {
  getKpis() {
    return [
      { name: 'Pedidos', value: 0, tone: 'flat', caption: 'neste período' },
      { name: 'Receita', value: 'R$ 0,00', tone: 'flat', caption: 'acumulado' },
      { name: 'Clientes', value: 0, tone: 'flat', caption: 'ativos' },
      { name: 'Produtos', value: 0, tone: 'flat', caption: 'em catálogo' },
    ]
  },

  getHealthOverview() {
    return {
      score: 0,
      message: 'Sem dados registrados. O painel está zerado e pronto para uso.',
      domains: [
        { name: 'Vendas', status: '0 registros' },
        { name: 'Clientes', status: '0 cadastros' },
        { name: 'Produtos', status: '0 ativos' },
        { name: 'Operações', status: '0 em andamento' },
      ],
    }
  },
}