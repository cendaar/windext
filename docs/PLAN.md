# windext — plan v2 : base mondiale de spots alimentée par l'usage

Version du 17 octobre 2026. Remplace le plan v1 (sources de données et modèles : voir annexe A, inchangée).

## 1. Vision

Un serveur MCP gratuit que n'importe quel pratiquant de sport de vent branche à Claude. Chaque conversation apporte deux choses : une réponse utile tout de suite, et une donnée de plus dans une base mondiale ouverte des spots, de leurs conditions et de la fiabilité réelle des modèles météo spot par spot.

Le produit est l'outil de prévision. La base de données est ce que l'outil fabrique en étant utilisé.

## 2. Ce qu'on récolte, et pourquoi c'est utile tout de suite

| Donnée | Comment elle arrive | Utilité immédiate pour l'utilisateur | Valeur accumulée |
|---|---|---|---|
| **Fiche spot** : point de décollage, orientation, directions qui marchent / tolérées / interdites, type de plan d'eau, marée utile, dangers, règles, saison | Claude lit les guides publics, l'utilisateur confirme, `submit_spot` | la prévision devient « side-on, direction phare du spot » au lieu de « vent de NE » | base mondiale ouverte des spots, qui n'existe pas aujourd'hui |
| **Demande de prévision** (spot, date, sport), anonyme | chaque appel à `spot_forecast` | aucune directement | quels spots les gens veulent, quand ; priorise l'enrichissement |
| **Compte-rendu de session** : « j'y étais, 18 nœuds, ça a tenu de 14 h à 17 h » | prompt `session_report`, à l'initiative de l'utilisateur | Claude compare au prévu : « AROME avait raison, GFS surestimait » | **fiabilité des modèles par spot** : au bout de 50 sessions, on sait qu'à Ouistreham AROME surestime le NE de 3 nœuds. Personne n'a cette donnée |
| **Observation live** : « il y a 20 nœuds là maintenant » | prompt ou tool `report_wind` | sert aux autres utilisateurs du même spot dans l'heure | réseau de stations humaines là où il n'y a pas d'anémomètre |
| **Matériel sorti** : poids, aile, taille, et verdict (sous, bien, surtoilé) | dans le compte-rendu de session | conseil de taille calibré sur de vrais riders et non sur une table théorique | table de taille empirique par sport et par spot |
| **Correction de fiche** | `submit_spot` sur un spot existant | la fiche s'améliore pour le prochain | historique des corrections, consensus |

Aucune donnée personnelle : pas de compte, pas d'identifiant utilisateur, pas d'adresse IP stockée. Un compte-rendu est un fait sur un spot à une date, pas sur une personne.

## 3. Comment la boucle fonctionne, concrètement

1. L'utilisateur parle d'un spot. Claude appelle `find_spot`.
2. Le serveur renvoie la fiche si elle existe (vérifiée, communauté ou amorce), sinon le géocodage et une orientation estimée depuis le trait de côte OpenStreetMap, annoncée comme estimée.
3. Sans fiche, les instructions serveur font chercher Claude sur le web, avec sa propre recherche. Il extrait les faits, demande confirmation à l'utilisateur, puis appelle `submit_spot`. Statut « communauté ».
4. La prévision tient compte de la fiche : direction phare, offshore interdit, marée.
5. Après la session, le prompt `session_report` propose en une phrase de dire comment c'était. Claude appelle `report_session`. Le serveur rapproche la prévision archivée du jour et calcule l'erreur par modèle.
6. Dans l'admin, les fiches « communauté » passent en « vérifiée » après relecture. Les fiches vérifiées sont exportées en YAML dans le dépôt, licence CC BY-SA.

## 4. Amorçage : ne pas démarrer à vide

Une base vide ne récolte rien, parce que personne ne reste. Trois sources d'amorce, dans l'ordre :

1. **OpenStreetMap monde** : extraction de tous les objets `sport=kitesurfing|windsurfing|sailing` (Overpass, licence ODbL). Quelques milliers de points avec nom et position, sans info de vent. Statut « amorce ».
2. **Orientation de côte** calculée pour chaque point d'amorce depuis le trait de côte OSM, lissée sur 500 m.
3. **Session d'enrichissement par Claude Code** sur les 300 à 500 spots les plus connus au monde : Claude lit les guides publics, remplit la fiche en faits (pas de copie de texte), marque les sources. Statut « amorce enrichie ». Faisable en quelques heures de session, coût tokens seulement.

Un spot d'amorce, même incomplet, suffit à ce que `find_spot` réponde quelque chose de mieux qu'un géocodage.

## 5. Architecture

Tout sur Cloudflare, palier gratuit.

| Brique | Rôle | Limite gratuite | Besoin estimé à 10 000 utilisateurs actifs |
|---|---|---|---|
| Worker `windext-mcp` | serveur MCP, route `wind.oooooooo.dev` | 100 000 requêtes/jour | 20 000 à 50 000 |
| D1 (SQLite) | spots, fiches, sessions, prévisions archivées, erreurs modèles | 5 M lectures, 100 000 écritures/jour, 5 Go | très en dessous |
| KV | cache des prévisions Open-Meteo, 30 min par spot et jour | 100 000 lectures/jour | pour tenir le quota Open-Meteo |
| Cron Trigger | export YAML quotidien vers GitHub, purge, calcul des scores de modèles | inclus | |
| Pages ou Worker statique | page d'accueil, carte des spots, admin | inclus | |

Tables : `spots` (id, nom, alias, lat, lon, pays, type, facing, statut, source), `spot_wind` (spot, direction 16 secteurs, qualité : phare / ok / toléré / interdit), `spot_facts` (spot, clé, valeur, source, date), `requests` (spot, date demandée, sport, horodatage, sans identifiant), `forecast_archive` (spot, jour, modèle, heure, vent, rafale, direction, run), `sessions` (spot, jour, heures, vent observé, rafale, direction, sport, matériel, verdict), `model_scores` (spot, modèle, secteur de vent, biais, erreur moyenne, n).

Quota Open-Meteo : 10 000 appels par jour par IP, et le Worker sort avec des IP partagées. Le cache KV ramène un spot populaire à 48 appels par jour quel que soit le nombre d'utilisateurs. Au-delà, Open-Meteo propose une clé gratuite aux projets open source sur demande, à solliciter dès que le projet est public.

## 6. Outils et prompts, liste finale

Outils : `find_spot`, `spot_info`, `spot_forecast`, `ride_windows`, `wind_probability`, `forecast_trend`, `list_models`, `submit_spot`, `report_session`, `report_wind`, `nearby_spots` (quels spots marchent avec le vent prévu dans un rayon donné : le vrai outil de week-end).

Prompts : `session_check`, `spot_compare`, `weekend_planner`, `explain_gusts`, `gear_advice`, `session_report`.

Instructions serveur : grille de lecture chiffrée (modèles par échéance, seuils d'écart, seuils de rafale, sécurité), consigne de recherche web quand la fiche manque, consigne de proposer un compte-rendu après une session, consigne de ne jamais présenter une fiche « communauté » comme certaine.

## 7. Qualité et abus

- Trois statuts de fiche : amorce, communauté, vérifiée. Toujours affichés.
- Fusion par distance (500 m) et par alias, jamais d'empilement.
- Limite de débit par IP sur les écritures, sans la stocker (compteur KV à expiration).
- Un compte-rendu de session n'est accepté que si une prévision a été demandée pour ce spot et ce jour (sinon rien à comparer).
- Les scores de modèles ne sont publiés qu'à partir de 20 sessions par spot et secteur.
- Admin : file de modération, validation en un clic, journal des modifications.

## 8. Faisabilité, honnêtement

**Technique : facile.** Tout existe en gratuit, le serveur de base tourne déjà, D1 et KV s'ajoutent en une journée. Le seul vrai travail est le schéma et la modération.

**Données météo : solide.** Open-Meteo couvre le monde avec les modèles fins de chaque pays. Le point faible est le quota, réglé par le cache et la clé open source.

**Récolte : c'est le pari.** La base ne se remplit que si des gens utilisent l'outil. Trois conditions : l'outil doit être excellent sans la base (c'est le cas, la prévision multi-modèles se suffit), l'amorce doit donner l'impression que le spot est déjà connu, et le compte-rendu de session doit coûter une phrase, pas un formulaire. Ordre de grandeur réaliste : quelques centaines de spots enrichis la première année si la communication est faite dans les communautés, pas des dizaines de milliers.

**Qualité : le risque principal.** Claude peut mal lire un guide, un utilisateur peut se tromper de plage. Les statuts et la modération humaine sont la réponse, et ça te prend du temps à toi. Prévoir des modérateurs locaux par pays quand ça grossit.

**Juridique : propre.** Faits sur des lieux publics, pas de copie de contenu, pas de données personnelles, licence ouverte. OSM impose l'attribution ODbL, Open-Meteo l'attribution CC BY.

## 9. Intérêt

**Pour l'utilisateur** : la seule prévision qui lit tous les modèles, qui connaît l'orientation du spot, et qui finit par savoir quel modèle croire sur ce spot précis. Et un outil qui s'améliore à chaque session partagée.

**Pour toi** : un jeu de données unique, fiabilité des modèles par spot, qui n'existe nulle part, ni chez Windguru ni chez Windy. C'est la matière première d'une application, d'un widget dans Tides, ou d'une publication. Le code et la base sont ouverts, la marque et la communauté restent à toi.

**Pour la communauté** : la base ouverte de spots qu'on réclame depuis des années et que personne n'a construite, parce que la saisie manuelle n'intéresse personne. Ici la saisie est un sous-produit d'une question qu'on pose de toute façon.

## 10. Ordre de réalisation

1. D1 + KV, `submit_spot`, statuts dans `find_spot`, archive des prévisions. Déploiement sur wind.oooooooo.dev.
2. Amorce OSM monde + orientation de côte. Instructions serveur v2 avec consigne de recherche web.
3. `report_session`, calcul des erreurs par modèle, `nearby_spots`.
4. Admin de modération, export YAML quotidien, page carte.
5. Enrichissement des 300 spots majeurs par session Claude Code.
6. `.mcpb`, npm, plugin Claude Code, registre MCP, communication communautés.

## Annexe A — sources de données et modèles (plan v1, inchangé)

Open-Meteo : `forecast`, `marine`, `geocoding`, `ensemble`, `previous-runs`. Treize modèles avec rafales vérifiés sur Ouistreham le 17 octobre 2026 (AROME HD 1,5 km, AROME, ARPEGE, ICON-D2, ICON-EU, ICON, UKMO 2 km, UKMO global, DMI Harmonie 2 km, KNMI Harmonie 5,5 km, ECMWF 9 et 25 km, GFS, CMA). Modèles IA sans rafales exclus. Modèles régionaux hors France pris automatiquement par les identifiants seamless. Phase 2 : observations Météo-France (gratuit, clé), bouées NDBC, marées via tide-api. Écartés : Windy (payant), Windguru (pas d'API), scraping Windfinder.
