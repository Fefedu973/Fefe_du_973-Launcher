# Fefe du 973 Launcher

Launcher Minecraft desktop du serveur `mc.fefe-du-973.fr`, construit avec Electron, Vite, TypeScript et EML Lib.

Cette branche remplace l’ancien launcher maison par l’architecture EML :

- EML Lib télécharge Java, Minecraft, Fabric et le modpack ;
- EML AdminTool publie les profils, fichiers, actualités, fonds et mises à jour ;
- le launcher conserve la compatibilité avec le dossier de jeu historique `fefedu973` ;
- le jeu rejoint automatiquement `mc.fefe-du-973.fr:25565`.

## État

La branche `refactor/eml` est une branche de validation. Elle ne doit pas remplacer `master` avant que le profil AdminTool, le modpack et un lancement Minecraft complet aient été testés.

Fonctionnalités déjà intégrées :

- instance EML AdminTool 2.5 de validation disponible sur `eml-launcher.mc.fefe-du-973.fr` ;
- profil `Better Minecraft` configuré pour Minecraft 1.18.2 et Fabric 0.14.8 ;
- connexion locale par pseudo, compatible avec le serveur actuel ;
- connexion Microsoft facultative avec session chiffrée par Electron `safeStorage` ;
- profils, actualités, maintenance, fonds et mises à jour depuis AdminTool ;
- téléchargement automatique de Java et du modpack ;
- réglages RAM, résolution et comportement du launcher ;
- gestion des skins et capes pour les comptes Microsoft ;
- auto-connexion au serveur ;
- interface française et fonctionnement dégradé lorsque le backend est indisponible.

La sélection individuelle de mods optionnels n’est pas native dans EML 2.5. Elle sera développée après la migration fiable du modpack de base.

## Développement

Prérequis : Node.js 22.12 ou plus récent et npm. La CI utilise Node.js 24.

```bash
npm ci
npm run dev
```

L’URL AdminTool par défaut est :

```text
https://launcher.mc.fefe-du-973.fr
```

Pour cibler une instance de validation :

```powershell
$env:EML_ADMINTOOL_URL="https://eml-launcher.mc.fefe-du-973.fr"
npm run dev
```

`EML_ADMINTOOL_URL` est lu par le processus Electron. Il n’est pas exposé comme variable Vite dans le renderer.

## Validation

```bash
npm run check
npm run format:check
npm audit
npm run test:ui
npm run test:ui:online
```

`test:ui` vérifie le fonctionnement dégradé avec un AdminTool indisponible. `test:ui:online` vérifie la récupération du profil réel de validation. Les deux commandes démarrent Electron avec un profil utilisateur temporaire.

Après une construction Windows :

```bash
npm run release:win
npm run test:packaged
```

Les captures de contrôle sont écrites dans `.artifacts/`.

## Distribution

```bash
npm run release:win
```

Les fichiers nécessaires à EML AdminTool sont générés dans `release/` :

- `Fefe du 973 Launcher-Setup-<version>.exe`
- `Fefe du 973 Launcher-Setup-<version>.exe.blockmap`
- `latest.yml`

L’application est empaquetée dans `app.asar`; les bundles Vite sont minifiés. Cela réduit l’exposition accidentelle du code mais ne constitue pas une protection cryptographique contre l’analyse du client.

Le binaire Windows n’est pas signé pour l’instant. SmartScreen peut donc afficher un avertissement. Une signature Authenticode devra être ajoutée avant une distribution publique large.

Voir [docs/admintool-dokploy.md](docs/admintool-dokploy.md) pour le déploiement et [docs/modpack-migration.md](docs/modpack-migration.md) pour le basculement du modpack.

## Sources

- [Documentation EML](https://emlproject.com/docs)
- [EML Lib](https://github.com/Electron-Minecraft-Launcher/EML-Lib)
- [EML AdminTool](https://github.com/Electron-Minecraft-Launcher/EML-AdminTool)
