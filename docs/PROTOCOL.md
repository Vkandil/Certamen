# Protocole Certamen

1. `Quaestio` : l'utilisateur pose une question et ajoute éventuellement un contexte.
2. Round 0 : chaque `contendens` répond indépendamment avec `SYSTEM_RESPONSIO`.
3. Disputatio : chaque `contendens` reçoit les autres responsiones anonymisées, dans un ordre permuté par destinataire, puis révise sa réponse.
4. Determinatio : l'`arbiter` reçoit les responsiones finales, les dissensus et les idées perdues en route, puis tranche.
5. Résultat : l'UI affiche determinatio, dissensus, consensus, responsiones, journal d'appels, coûts et reveal.

Le domaine reste pur : l'orchestrateur reçoit un `LlmClient` injecté et ne dépend ni de React, ni de Dexie, ni de `fetch`.
