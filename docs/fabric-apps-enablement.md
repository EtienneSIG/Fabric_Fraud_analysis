# Activer « Fabric Apps (preview) » pour publier l'app Rayfin

Procédure vérifiée le 2026-09-01 sur le tenant sandbox MCAP
(`MngEnvMCAP379967.onmicrosoft.com`). À rejouer quand `npx rayfin up` renvoie
**HTTP 403 « The feature is not available »** lors de la création de l'item Rayfin :
cela signifie que le réglage tenant **Fabric App Items (preview)** n'est pas activé.

> 📸 Les captures ci-dessous sont dans `docs/images/fabric-apps/`. Si le dossier est
> vide, dépose-y les 3 captures de la procédure avec ces noms exacts :
> `01-pim-eligible-global-admin.png`, `02-tenant-setting-enable-toggle.png`,
> `03-tenant-setting-enabled.png`.

---

## Symptôme

```text
npx rayfin up --workspace-id da93926e-0c9e-48c8-8a00-7427172be9ff
# ... HTTP 403 : The feature is not available
```

Cause : l'item de type **Fabric App** (bâti sur le SDK Rayfin) est en preview et
doit être **activé au niveau du tenant**. Le réglage n'apparaît que si ton compte
agit comme **Fabric Administrator** (ou **Global Administrator**) — pas seulement
capacity admin.

---

## Étape 1 — Activer le rôle admin (PIM)

Dans ce sandbox, `Global Administrator` est attribué en **Eligible** (PIM) : il faut
l'**activer**, pas l'ajouter.

1. Va sur <https://entra.microsoft.com> → **Identity → Privileged Identity Management**
   (ou direct <https://portal.azure.com/#view/Microsoft_Azure_PIMCommon/ActivationMenuBlade/~/aadmigratedroles>).
2. **My roles → Microsoft Entra roles** → onglet **Eligible assignments**.
3. Ligne **Global Administrator** → **Activate**.
4. Duration = max proposé (ex. 8 h) ; Reason = « Enable Fabric Apps preview tenant setting » ;
   valide la MFA si demandée → **Activate**.
5. Attends « Role activated » (quelques secondes à 1-2 min).

![Rôle Global Administrator éligible via PIM — à activer](images/fabric-apps/01-pim-eligible-global-admin.png)

> `+ Add assignments` sert à donner le rôle à quelqu'un d'autre : ne pas l'utiliser ici.

---

## Étape 2 — Re-login Fabric

Le rôle actif n'est pris en compte qu'après une nouvelle session :

1. Déconnecte-toi de <https://app.fabric.microsoft.com> (menu profil → **Sign out**).
2. Reconnecte-toi.
3. **Settings** (⚙) → section **Governance and administration** → **Admin portal**.
   « **Tenant settings** » doit maintenant être visible à gauche.

---

## Étape 3 — Activer le réglage tenant

1. **Admin portal → Tenant settings**.
2. Cherche **« Fabric apps »**.
3. Ouvre **Enable Fabric App Items (preview)** → bascule sur **Enabled** →
   *Apply to* = **The entire organization** → **Apply**.
4. (Optionnel) Active aussi **Enable anonymous data access for Fabric Apps (Preview)**
   uniquement si tu exposes des données en accès public.

![Bascule Enabled du réglage Fabric App Items (preview)](images/fabric-apps/02-tenant-setting-enable-toggle.png)

Une fois appliqué, le statut passe à **Enabled for the entire organization** :

![Réglage activé pour toute l'organisation](images/fabric-apps/03-tenant-setting-enabled.png)

Laisse propager quelques minutes.

---

## Étape 4 — Publier l'app Rayfin

Depuis le dossier de l'app (là où vit `rayfin/rayfin.yml`) :

```powershell
cd c:\Github\Fabric_Fraud_analysis\fabric-fraud-intelligence
npx rayfin login      # si la session a expiré
npx rayfin up --workspace-id da93926e-0c9e-48c8-8a00-7427172be9ff
```

Le `--workspace-id` est celui de la capacité F2 provisionnée par Terraform
(`terraform output -raw fabric_workspace_id`).

### Résultat attendu (succès)

Une fois Fabric Apps activé, `rayfin up` déroule tout le pipeline sans 403 :
création de l'item Rayfin → compilation des entités `@entity` → application de la
config DAB → `npm run build:fabric` (build Vite) → déploiement du contenu statique.
La fin de sortie ressemble à :

```text
🎉 Project "fabric-fraud-intelligence" is now deployed to Fabric!
  - Rayfin Item ID:  636a2a84-62dc-44a2-8dfa-8c3f84ba4eb8
  - Fabric Workspace: da93926e-0c9e-48c8-8a00-7427172be9ff
  - Static Hosting URL: https://mild-falls-763438f7b8-swedencentral.webapp.fabricapps.net
```

- **URL live** : `https://<slug>-<region>.webapp.fabricapps.net` (ajoutée
  automatiquement aux *allowed redirect URIs*).
- Rayfin **écrit lui-même** `rayfin.yml` / `.deployments.json` — rien à créer à la main.
- Portail : `https://app.fabric.microsoft.com/groups/<workspaceId>/appbackends/<itemId>`.

> Si un ancien run affichait « il manque un yml » ou une erreur de config, c'était un
> effet de bord du **403** (l'item n'était pas créé). Une fois le 403 levé, `rayfin.yml`
> est régénéré par le déploiement.

---

## Pré-requis / rappels

- **Région** : Sweden Central supporte Fabric App (preview) — pas de changement de région.
- **Capacité** : une capacité Fabric (ici **F2**, `fabcapfraudinteldemo`) doit tourner ;
  elle est **facturée** tant qu'elle est active.
- **Rôle** : Global Admin ⊇ Fabric Admin. Un simple *capacity admin* ne voit pas
  « Tenant settings ».
- **CLI Rayfin** : `@microsoft/rayfin-cli` est une devDependency locale → toujours via
  `npx rayfin` depuis `fabric-fraud-intelligence/`.

## Nettoyage (si on renonce à publier)

Pour supprimer uniquement la capacité + le workspace Fabric (0 destroy du reste) :

```powershell
cd c:\Github\Fabric_Fraud_analysis\infra\terraform
$suffix = "-var=name_suffix="
$entra  = "-var=enable_entra_apps=false"
terraform apply $suffix $entra   # SANS -var=enable_fabric_workspace=true
```
