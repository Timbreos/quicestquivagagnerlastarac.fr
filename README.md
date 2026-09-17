# Qui c'est qui va gagner la Starac

Ligue privée de pronostics sur le classement final des élèves de la Star Academy. Un groupe d'amis
(4 à 10) classe tous les élèves avant le premier prime ; les points tombent à chaque sortie, en direct.

Référence fonctionnelle : la spec v1 du 17 septembre 2026 et le prototype Claude Design (tokens repris dans `app/globals.css`).

## Stack

- **Front** : Next.js 15 (App Router, TypeScript), export statique (`output: 'export'`), Tailwind 4.
- **Base, auth, temps réel, stockage** : Supabase. Auth par magic link, entrée par code d'invitation.
- **GIF** : API Tenor (clé publique, restreinte au domaine dans la console Google).
- **Hébergement** : GitHub Pages via GitHub Actions, domaine `quicestquivagagnerlastarac.fr` (fichier `public/CNAME`).

Aucun secret dans le bundle : tout passe par le client Supabase navigateur et les policies RLS.

## Arborescence

```
app/
  (auth)/login, (auth)/invite       connexion, entrée par code (/invite/?code=XXXX)
  (app)/page.tsx                    accueil : bandeau d'état, classement, dernier prime, chat
  (app)/vote, votes, points, regles, eleves (?id=), prime, moi, admin
components/  ui/, shell/, home/, chat/, vote/, prime/, admin/
lib/         supabase/client.ts, types.ts, season.tsx (store + realtime), derive.ts, scoring.ts, tenor.ts, image.ts, format.ts
supabase/    migrations/, seed.sql, tests/ (rejeu du scoring sur Postgres), config.toml
```

## Règles du jeu (résumé)

À chaque sortie, on regarde la place de sortie (17 = premier éliminé, 1 = vainqueur) et l'élève que
chaque joueur avait mis à cette place-là : exact → points « exact » ; sinon dans les nominés de la
semaine → points « nominé » (seulement si les nominés ne sont pas tous les restants) ; sinon 0.
Phase 2 à 8 restants, points divisés par deux, cumulée. Pronostic hebdo « qui part ce soir ? » à +5.
Le barème vit dans la table `scoring_rules`, modifiable par saison depuis le back-office.

Le calcul vit en base (vues `score_events` et `leaderboard`) : un repêchage, une correction ou un
changement de barème recalculent tout instantanément. Le front n'affiche que ce que Postgres a calculé.

## Démarrer

```bash
npm install
cp .env.example .env.local        # renseigner NEXT_PUBLIC_SUPABASE_URL / ANON_KEY / TENOR_KEY
npm run dev
```

### Base de données

Avec la CLI Supabase (`npm i -g supabase`) :

```bash
supabase start                    # stack locale
supabase db reset                 # applique supabase/migrations + seed.sql (saison de démo)
supabase link --project-ref xxxx  # projet réel
supabase db push                  # applique les migrations
```

Le seed crée une saison de démo (17 élèves fictifs, 6 joueurs, deux primes joués). Les comptes de
démo (`yanis@example.com`, …) n'ont pas de mot de passe : en local, envoie-toi un magic link depuis
l'app (Inbucket sur http://localhost:54324).

### Rejouer le scoring (lot 1)

`supabase/tests/scoring_test.sql` joue une saison jouet dont tous les totaux sont calculés à la main
et vérifie la RLS (révélation, notes privées, verrouillage). Sur un Postgres 16 local :

```bash
PGHOST=localhost PGUSER=postgres bash supabase/tests/run.sh
```

La même vérification tourne en CI (`.github/workflows/db-test.yml`) à chaque modification de `supabase/`.

### Premier admin

Après avoir créé ton compte avec un code (ou en insérant une ligne dans `invites` via le SQL editor) :

```sql
update public.profiles set is_admin = true where display_name = 'TonPseudo';
```

Le premier code d'invitation se crée aussi en SQL : `insert into public.invites (code) values ('STARAC26');`

### Supabase : réglages à faire une fois

- **Auth → URL configuration** : Site URL `https://quicestquivagagnerlastarac.fr`, redirect URLs
  `https://quicestquivagagnerlastarac.fr/**` et `http://localhost:3000/**`.
- **Auth → Email** : magic link activé (par défaut).
- **Realtime** : la publication `supabase_realtime` est alimentée par la migration 0003.
- **Storage** : buckets `chat-images` et `contestant-photos` créés par la migration 0004.

## Déploiement

Push sur `main` → GitHub Actions construit l'export statique avec les variables publiques injectées
depuis les secrets du dépôt (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`NEXT_PUBLIC_TENOR_KEY`) et publie `out/` sur GitHub Pages. Activer Pages en mode « GitHub Actions »
dans les réglages du dépôt, et pointer le DNS du domaine vers GitHub Pages.

## Sécurité

- Les classements des autres ne sont lisibles qu'après révélation (policy RLS + vue `ranking_items_public`).
- La colonne `ranking_items.comment` (carnet privé) n'est lisible que par son auteur, sans exception.
- La fermeture des votes et des pronostics est vérifiée par les policies et les triggers, pas par un bouton grisé.
- Un utilisateur connecté sans profil (pas de code d'invitation) ne voit rien.
