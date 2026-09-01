# Fraud IQ — Narratif exécutif orienté Microsoft Foundry

> **Pitch en une phrase :** Microsoft Foundry orchestre les faits gouvernés de Fabric et
> la réglementation publique à jour pour produire une analyse explicable, citée et soumise
> à validation humaine.

**Durée cible :** 8–10 minutes · **Audience :** direction risque, conformité, innovation et IA
**Foundry :** [Projet FraudIQ](https://ai.azure.com/nextgen/r/FyQciQyGSOm9599wsQw5qg,esig_demo,,esigfoundry,FraudIQ/home?tid=b7b9a0c6-fe36-41b6-a38d-582c6573e2ff) *(authentification requise)*

---

## 1. Le problème à résoudre (45 s)

Une enquête fraude combine deux mondes qui évoluent à des rythmes différents : les faits
internes d'un dossier et les obligations réglementaires externes. L'analyste doit retrouver
les preuves, chercher les textes applicables, vérifier leur actualité et documenter son
raisonnement avant toute action.

> *« Une réponse rapide ne suffit pas. En matière de fraude et de conformité, chaque fait
> et chaque obligation doivent pouvoir être vérifiés à leur source. »*

## 2. L'architecture agentique (1 min)

Dans le projet **FraudIQ**, `fraud-iq-orchestrator` utilise `gpt-5.6-terra` et combine
deux outils serveur :

1. **Fabric IQ** appelle le Fraud Intelligence Data Agent avec l'identité déléguée de
   l'utilisateur et récupère les faits gouvernés du Lakehouse.
2. **Web Search** recherche les règles, dates, seuils et recommandations sur des domaines
   réglementaires officiels.
3. **L'orchestrateur** sépare les faits, l'interprétation, les obligations applicables et
   les actions recommandées.
4. **La réponse** conserve les identifiants Fabric et les URL des textes réglementaires.

Les décisions de fraude, déclaration, blocage ou traitement client restent explicitement
réservées à un humain.

## 3. Parcours de démonstration

### Étape 1 — Montrer l'agent et ses outils (1 min)

- Ouvrir le projet **FraudIQ**, puis `fraud-iq-orchestrator`.
- Montrer le modèle `gpt-5.6-terra`.
- Montrer les outils **Fabric IQ** et **Web Search**.
- Expliquer que la connexion Fabric utilise `UserEntraToken` : les droits de l'utilisateur
  sont conservés, sans secret partagé dans le code.

> *« L'agent ne contourne pas la gouvernance de Fabric. Il agit avec l'identité et les
> autorisations de la personne qui l'interroge. »*

### Étape 2 — Démontrer le grounding réglementaire (2 min)

Saisir ce prompt validé :

> *« Quelles sont les obligations réglementaires européennes actuellement applicables en
> matière de détection et de déclaration des opérations suspectes ? Cite uniquement des
> sources officielles et précise la date de chaque texte utilisé. »*

- Montrer les citations vers **EUR-Lex**, la **Commission européenne** et l'**EBA**.
- Ouvrir une citation et retrouver l'obligation dans le texte source.
- Montrer que la réponse distingue les exigences juridiques des recommandations pratiques.

> *« Nous ne demandons pas au modèle de réciter sa mémoire. Nous lui demandons de rechercher,
> citer et rendre vérifiable chaque élément réglementaire. »*

### Étape 3 — Expliquer le contrôle des sources (1 min)

La configuration autorise 11 domaines officiels, dont ACPR, AMF, Banque de France, CNIL,
EBA, Commission européenne, EUR-Lex, GAFI, Legifrance et les ministères français concernés.

- La consigne agent refuse les sources non officielles.
- Le validateur automatique exige au moins une citation.
- Il échoue si une URL citée sort de la liste autorisée.
- Les requêtes web ne doivent contenir ni PII, ni numéro de compte, ni détail de transaction.

### Étape 4 — Rapprocher dossier et réglementation (2 min)

Après avoir vérifié le consentement Fabric de l'opérateur, saisir :

> *« Pour le dossier AML ouvert le plus risqué, distingue les faits disponibles dans Fabric,
> les obligations réglementaires européennes applicables et les actions à soumettre à
> validation humaine. Cite les textes officiels et conserve les identifiants du dossier. »*

Présenter la structure attendue :

1. **Faits Fabric** avec identifiants et données manquantes.
2. **Interprétation** clairement séparée des faits.
3. **Obligations** avec liens vers les textes officiels.
4. **Actions proposées** sans décision autonome.

Si Fabric renvoie une demande de consentement ou ne produit aucun résultat, le dire pendant
la démonstration : le grounding réglementaire reste opérationnel, mais la combinaison avec
les données internes exige une identité autorisée et un consentement délégué valide.

### Étape 5 — Montrer la traçabilité (1 min)

- Ouvrir la trace d'exécution de l'agent.
- Identifier les appels aux outils, les résultats utilisés et la réponse finale.
- Expliquer que la validation automatisée du dépôt teste les citations après déploiement.

> *« La valeur n'est pas seulement la réponse finale. C'est la capacité à comprendre quels
> outils ont été appelés, quelles sources ont été utilisées et où l'humain doit intervenir. »*

## 4. Garde-fous et limites (1 min)

- **Identité déléguée :** Fabric applique les permissions de l'opérateur.
- **Séparation des données :** les faits du dossier restent dans Fabric ; la recherche web
  reçoit uniquement des concepts juridiques génériques.
- **Sources contrôlées :** les citations sont limitées et testées contre une allow-list.
- **Décision humaine :** aucune décision finale de fraude, SAR, blocage ou relation client.
- **Limite assumée :** une allow-list dans le prompt et la validation n'est pas une restriction
  réseau absolue. Un Bing Custom Search dédié est recommandé pour un filtrage serveur strict.

## 5. Conclusion (30 s)

> *« Foundry transforme une recherche réglementaire et une collecte de preuves dispersées
> en un raisonnement structuré, traçable et vérifiable. L'agent accélère l'enquête ; il ne
> remplace ni le contrôle humain ni la responsabilité réglementaire. »*

**Prochaine étape proposée :** sélectionner un scénario AML et un scénario fraude au paiement,
valider les réponses avec conformité et mesurer le temps gagné sur la recherche, la collecte
de preuves et la préparation du dossier.

### Aide-mémoire

- **1** agent orchestrateur : `fraud-iq-orchestrator`
- **1** modèle : `gpt-5.6-terra`
- **2** outils serveur : Fabric IQ + Web Search
- **11** domaines réglementaires officiels autorisés
- **12** citations officielles retournées lors du test de grounding web validé
- **1** validation humaine obligatoire avant toute décision