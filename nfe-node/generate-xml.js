const { create } = require('xmlbuilder2');
const fs = require('fs');

// Exemplo simples de geração de XML NF-e (v4.00) - preencher conforme sua regra de negócio
// Este gerador cria a estrutura mínima. Ajuste campos e elementos fiscais conforme necessidade.

const cfg = require('./config.example.json');

function buildNFe(data) {
  const root = create({ version: '1.0', encoding: 'UTF-8' }).ele('NFe', { 'xmlns': 'http://www.portalfiscal.inf.br/nfe' });

  const infNFe = root.ele('infNFe', { Id: `NFe${data.chave}`, versao: cfg.schemaVersion });

  // ide
  const ide = infNFe.ele('ide');
  ide.ele('cUF').txt(data.cUF);
  ide.ele('cNF').txt(data.cNF);
  ide.ele('natOp').txt(data.natOp);
  ide.ele('mod').txt('55');
  ide.ele('serie').txt(data.serie);
  ide.ele('nNF').txt(data.numero);
  ide.ele('dhEmi').txt(data.dhEmi);
  ide.ele('tpNF').txt(data.tpNF);
  ide.ele('idDest').txt(data.idDest);
  ide.ele('cMunFG').txt(data.cMunFG);
  ide.ele('tpImp').txt('1');
  ide.ele('tpEmis').txt('1');
  ide.ele('cDV').txt(data.cDV);
  ide.ele('tpAmb').txt(cfg.ambiente);

  // emit
  const emit = infNFe.ele('emit');
  emit.ele('CNPJ').txt(cfg.emitente.cnpj);
  emit.ele('xNome').txt(cfg.emitente.razao_social);
  const enderEmit = emit.ele('enderEmit');
  enderEmit.ele('xLgr').txt(cfg.emitente.endereco);
  enderEmit.ele('xMun').txt(cfg.emitente.municipio);
  enderEmit.ele('UF').txt(cfg.emitente.uf);
  emit.ele('IE').txt(cfg.emitente.ie);

  // dest
  const dest = infNFe.ele('dest');
  dest.ele('CNPJ').txt(data.destCNPJ);
  dest.ele('xNome').txt(data.destNome);
  const enderDest = dest.ele('enderDest');
  enderDest.ele('xLgr').txt(data.destEndereco);
  enderDest.ele('xMun').txt(data.destMunicipio);
  enderDest.ele('UF').txt(data.destUF);

  // det - produtos
  data.produtos.forEach((p, index) => {
    const det = infNFe.ele('det', { nItem: index + 1 });
    const prod = det.ele('prod');
    prod.ele('cProd').txt(p.codigo);
    prod.ele('xProd').txt(p.descricao);
    prod.ele('NCM').txt(p.ncm || '00000000');
    prod.ele('CFOP').txt(p.cfop || '5102');
    prod.ele('uCom').txt(p.un || 'UN');
    prod.ele('qCom').txt(p.quantidade.toFixed(2));
    prod.ele('vUnCom').txt(p.valor_unitario.toFixed(2));
    prod.ele('vProd').txt((p.quantidade * p.valor_unitario).toFixed(2));

    // impostos (exemplo simplificado)
    const imposto = det.ele('imposto');
    const icms = imposto.ele('ICMS');
    const icms00 = icms.ele('ICMS00');
    icms00.ele('orig').txt('0');
    icms00.ele('CST').txt('00');
    icms00.ele('modBC').txt('0');
    icms00.ele('vBC').txt('0.00');
    icms00.ele('pICMS').txt('0.00');
    icms00.ele('vICMS').txt('0.00');
  });

  // total
  const total = infNFe.ele('total');
  const ICMSTot = total.ele('ICMSTot');
  ICMSTot.ele('vProd').txt(data.totais.valor_produtos.toFixed(2));
  ICMSTot.ele('vNF').txt(data.totais.valor_nota.toFixed(2));

  // transport
  const transp = infNFe.ele('transp');
  transp.ele('modFrete').txt('0');

  // infAdic
  const infAdic = infNFe.ele('infAdic');
  infAdic.ele('infCpl').txt(data.informacoes_complementares || '');

  const xml = root.end({ prettyPrint: true });
  return xml;
}

// Exemplo de dados mínimos para geração
const exemplo = {
  chave: '41210700000000000000550000000000000000000000',
  cUF: '31',
  cNF: '00000005',
  natOp: 'VENDA DE MERCADORIA',
  serie: '3',
  numero: '5',
  dhEmi: new Date().toISOString(),
  tpNF: '1',
  idDest: '1',
  cMunFG: '3106200',
  cDV: '5',
  destCNPJ: '00000000000000',
  destNome: 'DESTINATARIO EXEMPLO LTDA',
  destEndereco: 'Rua Exemplo, 100',
  destMunicipio: 'BELO HORIZONTE',
  destUF: 'MG',
  produtos: [
    { codigo: '1', descricao: 'PRODUTO EXEMPLO', ncm: '00000000', cfop: '5102', un: 'UN', quantidade: 1, valor_unitario: 750.00 }
  ],
  totais: { valor_produtos: 750.00, valor_nota: 750.00 },
  informacoes_complementares: 'Observações de exemplo para a Nota Fiscal Eletrônica.'
};

const xml = buildNFe(exemplo);
fs.writeFileSync('nfe_unnsigned.xml', xml, 'utf8');
console.log('XML NF-e não assinado gerado: nfe_unnsigned.xml');
