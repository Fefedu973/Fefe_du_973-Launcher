# Déployer EML AdminTool dans Dokploy

## Architecture retenue

EML AdminTool est déployé dans le projet Dokploy `Minecraft`, dans un Compose dédié :

```text
Internet
  -> Traefik / HTTPS
  -> EML AdminTool :3000
      -> PostgreSQL :5432, réseau Docker privé uniquement
```

Le launcher, le serveur Minecraft et AdminTool restent trois responsabilités distinctes :

- le dépôt launcher produit les installateurs ;
- AdminTool distribue les profils, fichiers et installateurs ;
- le serveur Minecraft exécute le jeu.

L’updater officiel d’AdminTool n’est pas déployé. Il demande l’accès au socket Docker de l’hôte. L’image AdminTool est épinglée et ses mises à jour sont déclenchées depuis Dokploy après lecture des notes de version.

État de l’instance de validation :

| Élément         | Valeur                                                    |
| --------------- | --------------------------------------------------------- |
| Compose Dokploy | `EML AdminTool`                                           |
| Domaine         | `eml-launcher.mc.fefe-du-973.fr`                          |
| Image           | `ghcr.io/electron-minecraft-launcher/eml-admintool:2.5.0` |
| Base            | PostgreSQL 18.1 privée                                    |
| Langue          | Français                                                  |
| Profil          | `Better Minecraft`                                        |

Le fichier source correspondant est [deploy/eml-admintool.compose.yml](../deploy/eml-admintool.compose.yml).

## Compose de référence

Le service est d’abord publié sur `eml-launcher.mc.fefe-du-973.fr`. Le domaine actuel `launcher.mc.fefe-du-973.fr` reste sur le backend historique jusqu’à la validation finale.

```yaml
services:
  web:
    image: ghcr.io/electron-minecraft-launcher/eml-admintool:2.5.0
    restart: unless-stopped
    environment:
      NODE_ENV: production
      BODY_SIZE_LIMIT: Infinity
      ORIGIN: https://eml-launcher.mc.fefe-du-973.fr
      ALLOWED_ORIGINS: https://eml-launcher.mc.fefe-du-973.fr
    volumes:
      - eml_files:/app/files
      - eml_env:/app/env
      - eml_data:/app/data
    depends_on:
      dbs:
        condition: service_healthy

  dbs:
    image: postgres:18.1
    restart: unless-stopped
    environment:
      POSTGRES_USER: eml
      POSTGRES_PASSWORD: eml
      POSTGRES_DB: eml_admintool
    volumes:
      - eml_database:/var/lib/postgresql
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U eml -d eml_admintool']
      interval: 5s
      timeout: 5s
      retries: 20

volumes:
  eml_files:
  eml_env:
  eml_data:
  eml_database:
```

Le nom de service `dbs` est obligatoire avec l’image officielle 2.5.0 : son entrypoint attend ce nom avant d’exécuter Prisma.

Ne pas publier le port PostgreSQL et ne pas ajouter de domaine au service `dbs`.

## Initialisation

1. Déployer le Compose sur le domaine temporaire.
2. Ouvrir immédiatement l’assistant de configuration.
3. Sélectionner le français.
4. Générer un mot de passe PostgreSQL fort dans l’assistant.
5. Créer un compte administrateur avec un mot de passe unique.
6. Vérifier que `/app/env/.env` est présent dans le volume `eml_env`.
7. Redémarrer le Compose et vérifier que la session et les données persistent.

Le mot de passe `eml` du Compose est seulement la valeur d’amorçage interne. L’assistant modifie ensuite le mot de passe PostgreSQL et enregistre la nouvelle URL dans le volume privé `eml_env`.

EML AdminTool 2.5 appelle son conteneur optionnel `upd` après avoir écrit la configuration finale. Comme ce déploiement n’accorde volontairement pas le socket Docker à AdminTool, la dernière requête de l’assistant peut signaler une erreur après avoir correctement écrit `/app/env/.env`. Dans ce cas :

1. vérifier que le fichier persistant contient `IS_CONFIGURED="true"` ;
2. redémarrer uniquement le conteneur `web` ;
3. vérifier que `/api/ping`, `/api/profiles`, `/api/loader` et `/api/bootstraps` répondent correctement.

Ne pas relancer les premières étapes de l’assistant après la création de l’administrateur : elles ne sont pas conçues pour être rejouées.

## Volumes et sauvegardes

Sauvegarder ensemble :

- `eml_database` : comptes, profils et métadonnées ;
- `eml_files` : modpacks et fichiers de bootstrap ;
- `eml_env` : secrets et connexion PostgreSQL ;
- `eml_data` : données applicatives restantes.

Une sauvegarde de base sans les fichiers n’est pas suffisante. Une sauvegarde des fichiers sans `eml_env` ne permet pas une restauration identique.

Prévoir une sauvegarde quotidienne vers le disque de masse, puis une seconde copie hors machine pour les éléments irremplaçables.

## Durcissement

- seule l’entrée HTTPS Traefik doit être publique ;
- PostgreSQL reste sur le réseau Compose ;
- aucun montage du socket Docker ;
- mot de passe administrateur généré et unique ;
- volumes sauvegardés avant chaque mise à jour ;
- image AdminTool épinglée, jamais `latest` ;
- bouton d’auto-mise à jour AdminTool inutilisable volontairement ; effectuer les mises à jour depuis Dokploy ;
- validation du launcher sur une machine de test avant la publication d’un bootstrap.

Le panel contient des routes publiques nécessaires aux launchers. Il ne faut donc pas protéger tout le domaine avec Authentik. L’administration utilise l’authentification native d’EML.

## Publication du launcher

Pour chaque version Windows, charger dans `Bootstraps` les trois fichiers exacts :

```text
Fefe du 973 Launcher-Setup-<version>.exe
Fefe du 973 Launcher-Setup-<version>.exe.blockmap
latest.yml
```

Ne pas les renommer. Le numéro de version de `latest.yml` doit correspondre à `package.json`.

## Basculement final

Le domaine principal n’est déplacé vers EML que si les contrôles suivants passent :

- connexion locale ;
- récupération du profil ;
- installation sur un dossier vide ;
- reprise du dossier historique `fefedu973` ;
- téléchargement de Java ;
- synchronisation des mods et configurations ;
- lancement Fabric 1.18.2 ;
- connexion à `mc.fefe-du-973.fr` ;
- redémarrage du launcher ;
- mise à jour de test vers une version supérieure.

Après validation :

1. sauvegarder le backend historique ;
2. déplacer `launcher.mc.fefe-du-973.fr` vers le service EML dans Dokploy ;
3. reconstruire le launcher avec l’URL principale ;
4. publier la version finale ;
5. retirer le domaine temporaire ;
6. conserver l’ancien backend arrêté pendant une courte fenêtre de retour arrière, puis le supprimer.
