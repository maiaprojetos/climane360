# Painel Meteorológico NE — V40

Evolução da V10 mantendo o layout e o design original.

## Alterações da V40
- Ampliação da camada de aeroportos para incluir aeroportos principais, regionais, de menor porte e instalações militares/civil-militares na área NE.
- Ícones diferenciados por tipo de aeródromo.
- Clique em qualquer aeroporto para abrir uma caixa **METAR verde**.
- A caixa mostra ICAO, nome, cidade/UF, tipo, horário da observação, teto, vento, direção e METAR bruto.
- Botão direto para `https://metar-taf.com/ICAO`, substituindo ICAO pelo código do aeródromo.
- Mantida a consulta de METAR/TAF e voos existentes via `/api/airport`.
- Fallback: se a API local estiver indisponível, o popup continua oferecendo o link direto do METAR/TAF.

## Fontes
A lista de aeródromos/ICAO foi conferida com referências do DECEA/AISWEB e documentos oficiais. A meteorologia automática usa Aviation Weather Center.

## Deploy
Publique como projeto Vercel/Netlify com a função `/api/airport`. GitHub Pages sozinho não executa a função serverless.
