# windext — plan

## 1. Sources de données

### Utilisées aujourd'hui (Open-Meteo, gratuit, sans clé, CC BY 4.0)

| Endpoint | Rôle | Quota |
|---|---|---|
| `api.open-meteo.com/v1/forecast` | vent 10 m, rafales, direction, par modèle ; variables d'instabilité (T2m, CAPE, pluie, vent 80 m) | 10 000 appels/jour/IP |
| `marine-api.open-meteo.com/v1/marine` | température de surface de la mer, hauteur de vague | idem |
| `geocoding-api.open-meteo.com/v1/search` | nom de lieu → coordonnées | idem |

Les appels partent du Worker Cloudflare (IP partagée) : à surveiller si le projet décolle, bascule possible sur l'offre « API key » d'Open-Meteo (gratuite pour l'open source sur demande) ou cache KV d'une heure par spot.

### Modèles vérifiés sur Ouistreham (17 oct. 2026)

Disponibles avec rafales :

| Id Open-Meteo | Modèle | Résolution | Couverture | Usage |
|---|---|---|---|---|
| `meteofrance_arome_france_hd` | AROME HD | 1,5 km | France + marges | référence < 48 h en France |
| `meteofrance_arome_france` | AROME | 2,5 km | France | secours |
| `meteofrance_arpege_europe` | ARPEGE | 11 km | Europe | 2 à 4 jours |
| `icon_d2` | ICON-D2 | 2 km | Europe centrale + Manche | référence < 48 h Allemagne/Alpes |
| `icon_eu` / `icon_global` | ICON-EU / ICON | 7 / 11 km | Europe / monde | 2 à 7 jours |
| `ukmo_uk_deterministic_2km` | UKMO UKV | 2 km | Royaume-Uni + Manche | référence < 48 h UK |
| `ukmo_global_deterministic_10km` | UKMO global | 10 km | monde | 2 à 7 jours |
| `dmi_harmonie_arome_europe` | DMI Harmonie | 2 km | Europe du Nord jusqu'à la Manche | très bon sur Manche/mer du Nord |
| `knmi_harmonie_arome_europe` | KNMI Harmonie | 5,5 km | Europe de l'Ouest | bon sur Manche/mer du Nord |
| `ecmwf_ifs` | ECMWF IFS | 9 km | monde | référence 3 à 10 jours |
| `ecmwf_ifs025` | ECMWF IFS | 25 km | monde | secours |
| `gfs_seamless` | GFS (+HRRR 3 km aux USA) | 25 km | monde | arbitre |
| `cma_grapes_global` | CMA | 15 km | monde | optionnel |

Disponibles sans rafales (exclus par défaut) : `ecmwf_aifs025_single` (IA ECMWF), `gfs_graphcast025` (IA Google), `bom_access_global`.

Non couverts à Ouistreham, mais utiles ailleurs : `knmi_harmonie_arome_netherlands` (2 km Benelux), `metno_nordic` (1 km Scandinavie), `meteoswiss_icon_ch1` (1 km Suisse/Alpes), `italia_meteo_arpae_icon_2i` (2 km Italie), `gem_hrdps_continental` (2,5 km Canada), `jma_msm` (5 km Japon), `kma_ldps` (1,5 km Corée), `ncep_hrrr_conus` (3 km USA), `ncep_nbm_conus` (USA).

Règle retenue : les identifiants `*_seamless` choisissent automatiquement le modèle le plus fin disponible pour le point, avec repli global. On les garde par défaut et on affiche le modèle réellement servi. Hors Europe, KNMI et DMI se replient sur ECMWF et feraient doublon : retirés hors Europe (déjà fait).

### API Open-Meteo complémentaires, testées, à intégrer

| API | Ce qu'elle apporte | Outil prévu |
|---|---|---|
| `ensemble-api.open-meteo.com` | 122 membres à Ouistreham (ECMWF 51, ICON-EPS 40, GEFS 31) : 11,7 à 18,6 kn à 12 h | `wind_probability` : probabilité de dépasser N nœuds par heure |
| `previous-runs-api.open-meteo.com` | la même heure vue par le run d'hier et d'avant-hier (11,4 vs 12,8 kn) | `forecast_trend` : la prévision monte, baisse ou se stabilise |

### Autres API évaluées

| Source | Verdict |
|---|---|
| MET Norway Locationforecast | gratuit sans clé, mais un seul modèle et pas de rafales hors Scandinavie : inutile en plus d'Open-Meteo |
| NOAA NWS | USA seulement, HRRR déjà via Open-Meteo : non |
| Windy Point Forecast | 990 €/an, sans ECMWF : non |
| Windguru | pas d'API : non |
| Stormglass, Meteomatics | payants : non |
| **Météo-France observations** (`portail-api.meteofrance.fr`) | gratuit depuis 2024, clé requise, stations au pas de 6 min, France : **phase 2, stations live** |
| **NOAA NDBC** | bouées temps réel, gratuit : **phase 2, USA et large** |
| Synoptic Data | stations mondiales, gratuit pour données ouvertes, clé : phase 2 si besoin hors France |
| Windfinder (scraping) | fragile, contraire aux CGU : non |
| **tide-api (projet Tides)** | déjà développé en interne : **phase 2, marées** |

## 2. Outils

### Existants
- `find_spot`, `spot_forecast`, `ride_windows`, `list_models`.

### Phase 1 (avant communication)
- `spot_forecast` : afficher le modèle réellement servi (AROME HD plutôt que « AROME/ARPEGE »), passer ECMWF en 9 km.
- `wind_probability` (ensemble) : P(vent ≥ seuil) par heure, et fourchette 10-90 %.
- `forecast_trend` (runs précédents) : évolution de la prévision sur 48 h de runs.
- Registre de spots : fichier `spots.yaml` dans le dépôt (nom, coordonnées, orientation de plage, directions qui marchent, dangers, marée utile). Contribution par pull request. `find_spot` cherche d'abord dans le registre, puis géocode.
- Cache KV Cloudflare, 30 min par spot et jour, pour tenir le quota.

### Phase 2
- `live_wind` : stations Météo-France (France) et NDBC (USA, large).
- `tides` via tide-api.
- Bundle `.mcpb`, paquet npm, plugin Claude Code avec skill.

### Phase 3
- Soumission registre MCP officiel et annuaire de connecteurs Claude.
- Annonce communautés kite, wing, windsurf.

## 3. Prompts et instructions

### Instructions serveur (envoyées à Claude à la connexion)
Déjà en place. À enrichir avec :
- Lecture par échéance : < 48 h modèle fin régional ; 2 à 5 jours ECMWF ; au-delà, tendance d'ensemble seulement.
- Lecture de `SPREAD` : ≤ 4 kn fiable, 4 à 8 à confirmer le matin même, > 8 ne pas planifier.
- Facteur de rafale : < 1,3 régulier, 1,3 à 1,6 normal, 1,6 à 1,9 pénible, ≥ 1,9 dangereux pour débutant.
- Sécurité : offshore interdit kite/wing sans bateau ; side-off toléré pour expert ; marée descendante + offshore = danger majeur.
- Taille de matériel : table indicative par poids et nœuds (kite, wing, voile), à dire comme un ordre de grandeur.
- Toujours répondre dans la langue de l'utilisateur, en nœuds.

### Prompts MCP (apparaissent comme raccourcis dans Claude Desktop)
| Prompt | Arguments | Question posée |
|---|---|---|
| `session_check` (fait) | spot, sport, jour | ça vaut le coup d'y aller ? |
| `spot_compare` | spot A, spot B, jour | lequel choisir ? |
| `weekend_planner` | région ou liste de spots | meilleur créneau du week-end |
| `explain_gusts` | spot, jour | pourquoi c'est rafaleux, en termes simples |
| `gear_advice` | poids, sport, niveau, spot, jour | quelle taille sortir |

### Skill (plugin Claude Code et Desktop)
Fichier `SKILL.md` avec la même grille de lecture que les instructions, plus des exemples de réponses attendues, pour que le comportement soit identique dans Claude Code.

## 4. Vérifications avant déploiement
- [ ] Spot hors Europe (Tarifa, Brésil, Cap Town) : pas de doublons de modèles, rafales présentes.
- [ ] Spot de lac ou lagune : l'API marine renvoie vide, le diagnostic air-mer doit se taire.
- [ ] Hémisphère sud : fuseau et saison corrects.
- [ ] Charge : 100 appels en rafale sur le Worker sans erreur 429 d'Open-Meteo.
- [ ] Taille de réponse : 7 jours sur 7 modèles sous 4 000 tokens.
