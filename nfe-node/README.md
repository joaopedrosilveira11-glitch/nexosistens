Projeto: nfe-node-generator
=========================

Objetivo
--------
Exemplo de gerador, assinador (A1 .pfx) e transmissor (NFe Autorização) para NF-e modelo 55 em Node.js.

Atenção importante
------------------
- Use primeiro em ambiente de homologação antes de apontar para produção.
- A transmissão para SEFAZ exigirá endpoints corretos por UF/ambiente e certificado válido.
- Nunca compartilhe a senha do seu PFX em repositórios públicos.

Instalação
---------
1. Colocar o arquivo PFX em uma pasta local (ex.: ./certs/empresa.pfx) e ajustar config.example.json
2. Copiar config.example.json para config.json e preencher os valores (pfxPath, pfxPassword, endpointAutorizacao, emitente, etc.)
3. Instalar dependências:
   npm install

Uso
---
1. Gerar XML não assinado (exemplo):
   npm run generate
   -> cria nfe_unnsigned.xml

2. Assinar (usando o arquivo .pfx configurado em config.json):
   npm run sign
   -> cria nfe_signed.xml

3. Transmitir para o endpoint configurado (NFeAutorizacao):
   npm run transmit
   -> grava transmit_response.xml com a resposta SOAP

Observações técnicas
--------------------
- O gerador cria um XML NF-e simplificado (v4.00). Ajuste campos fiscais conforme a legislação e necessidades.
- O script de assinatura utiliza node-forge para extrair chave/cert do PFX e xml-crypto para assinar o elemento <infNFe>.
- A transmissão é feita via POST SOAP simples; dependendo do estado/ambiente pode ser necessário TLS mutual, cabeçalhos específicos e configuração adicional.

Próximos passos (opcionais que posso executar):
- Ajustar o gerador para suportar todos os grupos de impostos (ICMS, IPI, PIS, COFINS, ISS, etc.) conforme sua rotina fiscal.
- Gerar mapeamento de campos para preencher automaticamente a partir do seu banco de dados.
- Testar assinatura e transmissão localmente (você fornece o PFX e senha aqui no ambiente local) — vou orientar sobre como enviar o arquivo com segurança.

