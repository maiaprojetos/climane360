# Painel Meteorológico NE — V10

Baseado na V9, com:
- clique em cada município abrindo popup com o indicador selecionado e resumo meteorológico;
- vento atual em km/h e direção em graus/pontos cardeais no painel municipal, popup e resultados de pesquisa quando já consultados;
- novo indicador de mapa: 🌬 Vento agora;
- aeroportos com consulta METAR/TAF por ICAO via Aviation Weather Center;
- vento do METAR também exibido no popup do aeroporto;
- voos programados nas 10 horas anteriores e posteriores via SIROS/ANAC.

## Fontes
O Aviation Weather Center oferece METAR e TAF mundiais pela Data API. O SIROS/ANAC fornece os registros de voos programados. Os horários da API SIROS são tratados como UTC e exibidos no navegador em horário local.

## Deploy
Para `/api/airport`, publique como projeto Vercel/Netlify com funções serverless. GitHub Pages sozinho não executa a função `/api`.
