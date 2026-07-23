# Migration du modpack vers EML

## Profil initial

Créer un profil AdminTool :

| Champ             | Valeur              |
| ----------------- | ------------------- |
| Nom               | Better Minecraft    |
| Slug              | `better-minecraft`  |
| Profil par défaut | Oui                 |
| Serveur           | `mc.fefe-du-973.fr` |
| Port              | `25565`             |
| Version Minecraft | `1.18.2`            |
| Loader            | Fabric              |
| Version Fabric    | `0.14.8`            |

Ces versions reproduisent la configuration du backend historique. Elles ne doivent être modernisées qu’après une première migration fonctionnelle à l’identique.

## Contenu à publier

Importer seulement le contenu client nécessaire :

```text
mods/
config/
defaultconfigs/
resourcepacks/
shaderpacks/
```

Examiner séparément avant publication :

- `options.txt`, qui écraserait les préférences des joueurs à chaque synchronisation ;
- les fichiers contenant une IP locale, un token, un mot de passe ou un chemin absolu ;
- les mods uniquement serveur ;
- les caches et fichiers générés.

Ne jamais importer :

```text
logs/
saves/
screenshots/
crash-reports/
usercache.json
usernamecache.json
assets/
libraries/
versions/
```

EML gère Minecraft, les bibliothèques et le loader à partir de la configuration du profil.

## Méthode de comparaison

1. Extraire la liste des fichiers publiée par l’ancien backend.
2. Calculer les SHA-256 de chaque mod et configuration.
3. Construire un dossier client propre pour EML.
4. Comparer les noms, versions et hashes.
5. Importer ce dossier dans Files Updater.
6. Installer dans un nouveau dossier utilisateur temporaire.
7. Comparer le dossier obtenu avec le client historique.
8. Lancer et rejoindre le serveur.

Le premier objectif est l’équivalence fonctionnelle, pas la mise à jour des mods.

## Fichiers personnels

Le nettoyage EML est activé afin de retirer les fichiers obsolètes du modpack. Avant d’autoriser des mods personnels ou optionnels, il faut définir explicitement leur stockage et leurs exclusions. Sinon, ils peuvent être supprimés pendant la synchronisation.

La deuxième phase ajoutera un gestionnaire de composants :

- mods obligatoires ;
- mods optionnels avec état par profil ;
- dépendances et incompatibilités ;
- mods clients personnels ;
- shaderpacks ;
- exclusions de nettoyage.

Cette phase ne doit pas modifier le manifeste EML de base tant que le lancement standard n’est pas validé.

## Retour arrière

Jusqu’au basculement :

- ne pas supprimer les fichiers source historiques ;
- ne pas modifier le monde du serveur pour cette migration client ;
- garder une copie du manifeste et des archives de l’ancien backend ;
- tester avec un profil Windows séparé ou un dossier de jeu temporaire.
