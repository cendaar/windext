# Bench r2 (12 scenarios)

| Criterion | without | with windext |
|---|---|---|
| accuracy | 3.3 | 2.7 |
| safety | 2.3 | 3.0 |
| uncertainty | 3.6 | 3.4 |
| actionability | 3.9 | 2.9 |
| local_knowledge | 2.9 | 3.0 |
| concision | 3.2 | 2.4 |

Wins: with 2, without 6, tie 1

## windext errors to fix
- [tarifa-wing] Langue : la question est posée en espagnol, mais la réponse est en français.
- [tarifa-wing] La date est juste (le dimanche 18/10/2026 est bien le lendemain du samedi 17). En revanche, le pic de vent est mal placé : selon Open-Meteo (best match), il est d'environ 4,9 kn vers 16h, avec des rafales d'environ 10 kn vers 17h. A le met à 4 kn vers 11h. Les rafales « jusqu'à 14 kn » sont aussi plus fortes que ce que donne le modèle principal (8 à 10 kn).
- [tarifa-wing] Le CAPE de 1020 J/kg n'est pas sourcé : le modèle best match donne au plus environ 480 J/kg. A ne dit pas non plus que les averses tombent surtout entre 8h et 11h, alors que c'est précisément le créneau à éviter.
- [tarifa-wing] Marée : aucun horaire ni coefficient pour Tarifa. A s'appuie seulement sur une fiche OSM qu'il dit lui-même non vérifiée. Il aurait fallu au moins citer la table de Tarifa (marnage d'environ 1 à 2 m, plage plus étroite à marée haute).
- [tarifa-wing] A ne parle pas du courant du détroit, qui est le vrai danger à Los Lances quand on dérive avec peu de vent.
- [tarifa-wing] Le jargon interne (« Score windext », « 88 % des heures ») et la demande de valider la fiche du spot alourdissent la réponse sans aider le rider.
- [tarifa-wing] Il n'y a aucune source, et A ne conseille pas de vérifier une balise en temps réel le jour même.
- [tarifa-wing] Les seuils de matériel (12-14 kn pour la 5,5 m, 18-20 kn pour la 4 m à 72 kg) sont corrects. L'orientation du spot est juste : plage face au SW, Levante side-off, Poniente side-on.
- [leucate-windsurf] Le verdict se contredit : « windext dit non (0/10) », puis un créneau et une voile sont proposés « si tu y vas quand même ». La réponse ne dit pas clairement si c'est jouable ou non.
- [leucate-windsurf] Les Coussoules sont placées dans la lagune. C'est faux : Les Coussoules est la plage côté mer de La Franqui, donc offshore par Tramontane. Envoyer quelqu'un là en le croyant sur l'étang abrité est une erreur dangereuse. Le Goulet est bien un spot de l'étang.
- [leucate-windsurf] Le choix de voile ne tient pas compte des rafales. La 5,8 est recommandée avec des rafales prévues à 27-30 kn entre 9h et 11h (Open-Meteo : 27,2 kn à 9h, puis 29,5 kn à 10h et 11h). Par Tramontane très irrégulière, 85 kg sous 5,8 sera nettement surtoilé. La 4,7 aurait dû être l'option principale, ou au minimum l'option du matin.
- [leucate-windsurf] « Faiblit à 12–13 nœuds dès 15–16h, trop peu de vent pour planer » : le modèle donne encore 12-13,5 kn de moyenne avec des rafales à 23-26 kn jusqu'à 19h. De plus, la Tramontane est souvent sous-estimée à Leucate. Fermer l'après-midi n'est pas justifié.
- [leucate-windsurf] Eau à 21 °C et « combinaison 3/2 suffit » : vers le 18 octobre, la mer à Leucate est plutôt autour de 18-19 °C, et la Tramontane refroidit la surface par upwelling. L'air est à 14-15 °C, avec un fort refroidissement éolien. Il faut une 4/3. La température de l'air n'est pas mentionnée.
- [leucate-windsurf] Aucune indication sur l'heure de sortie de l'eau ni sur le coucher du soleil (vers 18h50-19h00 le 18/10).
- [leucate-windsurf] Pas de conseil pour décider le jour même, comme consulter une balise en temps réel ou un modèle AROME. « Les modèles sont plutôt d'accord » est affirmé sans source.
- [leucate-windsurf] Rien sur la sous-estimation classique de la Tramontane par les modèles globaux dans le couloir Corbières-mer.
- [cumbuco-week] La réponse est un message d'erreur de la CLI (« Command failed … no stdin data received ») et ne contient aucun contenu destiné au rider.
- [cumbuco-week] Aucun jour ni horaire recommandé pour la semaine qui commence le samedi 17/10/2026 (date vérifiée : c'est bien un samedi).
- [cumbuco-week] Le régime local n'est pas mentionné : à Cumbuco (Ceará, Brésil), la saison des alizés va d'environ juillet à janvier et octobre en est le pic. Le vent est d'E à ESE, side-shore à side-onshore sur la plage orientée nord-ouest. Il est plus faible le matin, se renforce l'après-midi (souvent 18 à 28 nœuds) et une composante thermique peut prolonger la session jusqu'au coucher du soleil.
- [cumbuco-week] Aucun choix d'aile : pour 70 kg dans ce régime, la 9 m sert de base, la 7 m pour les après-midis à plus de 25 nœuds et la 12 m pour les matinées ou les jours faibles.
- [cumbuco-week] Les marées ne sont pas abordées. Leur marnage semi-diurne, d'environ 2 à 3 m en vives-eaux, modifie le shore-break et le plan d'eau de la plage. La lagune de Cauípe, en eau plate, est moins sensible à la marée.
- [cumbuco-week] Aucune consigne de sécurité : rafales de l'après-midi, shore-break, vigilance en vives-eaux, buggys et jangadas sur la plage, zones de mise à l'eau encombrées, risque d'insolation et de coups de soleil.
- [cumbuco-week] Le niveau de confiance de la prévision n'est pas indiqué, et rien n'explique comment trancher le jour même.
- [garda-windsurf] « 17 °C même la nuit » est peu crédible à Torbole mi-octobre. Les minimales nocturnes tournent normalement autour de 9–13 °C, et une nuit aussi douce devrait au minimum être présentée comme une anomalie à vérifier.
- [garda-windsurf] Pelèr « souvent 15 à 25 kn » est un peu optimiste comme valeur typique. Un Pelèr normal donne plutôt 12–20 kn, et plus de 20 kn correspond surtout à une situation post-frontale bien marquée (foehn de nord).
- [garda-windsurf] Aucune consigne de sécurité : eau à environ 16–18 °C en octobre (combinaison 4/3 ou 5/4 conseillée), rafales et trous de vent du Pelèr près de la côte de Torbole, trafic des ferries et des voiliers, journée sans vent avec risque de dériver loin de la plage.
- [garda-windsurf] Rien de précis sur le spot : pas de mention du port de Torbole ni du centre de surf, ni de la forte canalisation du Pelèr dans la vallée du Sarca, ni de l'Ora qui remonte depuis le sud (de Malcesine vers Riva).
- [garda-windsurf] La remarque sur l'échec de connexion du serveur MCP « windext » est du bruit technique sans intérêt pour un rider.
- [garda-windsurf] Réponse en français alors que la question est posée en allemand. Ce n'est pas adapté au rider, même si c'est imposé par le système.
- [garda-windsurf] Point vérifié et correct : le 18 octobre 2026 tombe bien un dimanche. Les marées ne s'appliquent pas à un lac, et les deux réponses ont raison de ne pas en parler.
- [capetown-kite] Les données sont fidèles : ECMWF et ICON donnent un pic entre 14 h et 17 h, GFS reste à 8–10 kn. En revanche, le créneau 06h–09h annoncé à 8–10 kn ignore ICON, qui ne donne que 5–7 kn.
- [capetown-kite] Le titre « south-easter léger à modéré » contredit aussitôt « plutôt plein Sud ». Avec 175–193°, ce n'est pas un south-easter, et il aurait fallu le dire aussi clairement que A.
- [capetown-kite] Le paragraphe sur l'échec du serveur MCP windext est du remplissage technique inutile pour le rider.
- [capetown-kite] Aucune indication sur l'orientation par rapport à la plage : le S est side-shore à Blouberg, et un passage au SE devient side-off. La dérive vers le nord n'est pas mentionnée non plus.
- [capetown-kite] Rien sur l'eau froide (12–15 °C, combinaison 4/3 ou 5/4), ni sur les rochers ou le choix entre Kite Beach et Big Bay pour la mise à l'eau, ni sur la houle.
- [capetown-kite] Rien sur l'évolution de lundi, alors que le vent passe à l'OSO et faiblit, ce qui ferme la fenêtre.
- [capetown-kite] La réponse explique l'écart rafales/vent moyen par l'accélération autour de la Table Mountain. Or ce phénomène concerne surtout le SE, pas un flux de sud sous un ciel couvert.
- [dakhla-weekend] La réponse laisse voir l'outil interne : « score windext 3/10 », « l'outil classe… », « la fiche n'a pas été vérifiée », « je corrigerai la fiche ». C'est du bruit pour le rider, et le verdict « peut-être » affaiblit la décision.
- [dakhla-weekend] Le long paragraphe sur l'incohérence d'orientation (plage à 130°) ne sert pas le lecteur. Il aurait suffi de dire que le NNE est side-shore le long de la lagune et side-off sur certains spots de la rive ouest, d'où l'importance de rester dans la zone de secours d'un camp.
- [dakhla-weekend] Elle indique 4/10 pour dimanche (14–16 nœuds) contre 3/10 pour samedi (jusqu'à 18 nœuds, rafales à 25–26), sans expliquer ce classement contre-intuitif. Pour un rider de 65 kg, samedi après-midi est la meilleure fenêtre en 9 m puis 7 m.
- [dakhla-weekend] Les horaires de marée sont donnés en « ~ » avec 30 à 60 min d'incertitude possible, et aucune table officielle n'est citée. C'est honnête, mais ça reste approximatif : basse mer vers 10h25–10h50 samedi et pleine mer vers 16h45–17h05 d'après les tables publiques.
- [dakhla-weekend] Elle ne précise pas que le courant de jusant porte vers le sud, vers l'embouchure de la baie (risque de dérive en cas de casse), ni que le flot va contre le vent.
- [dakhla-weekend] Le coucher du soleil à 19h34 est correct, les mortes-eaux autour du premier quartier (18 oct.) sont exactes, et samedi 17 octobre 2026 tombe bien un samedi. Pas d'erreur factuelle majeure.
- [maui-kite] Le choix d'aile ne colle pas avec le vent annoncé. Pour 75 kg avec 15-17 nds de moyenne, il faut une 10-12 m. Une 8 m convient plutôt à 22-28 nds établis. Même en tenant compte des rafales à 28 nds, la recommander comme aile principale fait sortir le rider sous-toilé pendant la majeure partie de la session.
- [maui-kite] Garder la 10 m « si le vent reste autour de 12-14 nds » est incohérent : à 12-14 nds, 75 kg demandent une 12 m. Écarter la 12 m comme « trop grande demain » contredit les 12-14 nds annoncés après 15 h et avant 11 h.
- [maui-kite] Des rafales à 28 nds pour 15-17 nds de moyenne, soit un rapport de 1,7, c'est peu crédible sous un alizé établi. Aucune source n'est citée, et l'écart des modèles (10 à 21 nds) montre que ce chiffre n'est pas fiable.
- [maui-kite] Jargon interne qui n'est pas expliqué au rider : « score windext 4/10 », « verdict », « fenêtre 9h-18h du verdict », « fiche seed ».
- [maui-kite] La demande finale d'enregistrer les infos dans une « base communautaire » est du remplissage, sans rapport avec la question.
- [maui-kite] Faute de frappe : « surtoispé » au lieu de « surtoilé ».
- [maui-kite] Points vérifiés et justes : dimanche 18 octobre 2026, la règle de Kanaha qui interdit le kite avant 11 h, la limite FAA de 125 ft, l'interdiction dans le couloir de la piste à Spreckelsville, la direction ENE side-shore sur une plage orientée nord, et un coucher du soleil vers 18 h HST (17 h 59 est plausible).
- [maui-kite] Il ne précise pas que le kite n'est autorisé qu'entre le lever et le coucher officiels du soleil, ni la priorité des nageurs, pêcheurs et pirogues.
- [brouwersdam-wing] La question est posée en néerlandais, mais la réponse est en français.
- [brouwersdam-wing] La date est juste : le 18/10/2026 est bien un dimanche.
- [brouwersdam-wing] La moyenne de 12–13 nœuds entre 09:00 et 11:00 est optimiste. Le modèle Open-Meteo best-match donne 11,5 nœuds à 09h, 10,5 à 10h, 9,5 à 11h, puis seulement 5,1 nœuds à 12h. La fenêtre 09–12h est donc trop longue : en pratique, il faut viser 09–11h.
- [brouwersdam-wing] Les rafales réelles montent à 19–20 nœuds, pas 17–18. Le facteur de rafale est proche de 2, et non 1,5 comme annoncé.
- [brouwersdam-wing] La réponse parle d'un chop de 1 m côté Noordzee. La houle modélisée fait en réalité 1,4–1,5 m pour une période d'environ 6 s.
- [brouwersdam-wing] Elle ne donne ni l'heure de la marée ni le lever du soleil. Basse mer vers 14h et pleine mer vers 07h côté Noordzee ; lever du soleil à 08:13 CEST. Le dimanche 18/10 est encore à l'heure d'été.
- [brouwersdam-wing] L'orientation de la plage côté Grevelingen est donnée comme « ESE ». Elle regarde plutôt vers le SE (environ 130–140°), parallèlement à la digue SW–NE. L'orientation côté Noordzee est plutôt NW que WNW.
- [brouwersdam-wing] « Le vent passe sur la digue » est faux pour un vent de NE, qui est parallèle à la digue. Le vent ne traverse la digue que côté Noordzee, quand il passe à l'E/ESE, donc offshore.
- [brouwersdam-wing] La réponse expose des éléments internes à l'outil : « windext 0/10 », fiche « seed », score qui reste à 0. Elle se termine aussi par une question au rider. C'est du remplissage qui n'aide pas la décision.
- [brouwersdam-wing] Points positifs : conseil de combinaison 4/3 ou 5/4 avec une eau à 15,6 °C, désaccord entre modèles bien expliqué (UKMO/DMI contre ECMWF), règle de décision claire selon la station à 08:30.
- [wissant-berck] « 9 kn au mieux à Wissant » sous-estime le vent : AROME donne 11–12 kn de 13 h à 16 h (rafales 19–22), ECMWF environ 9,5 kn. La réponse ne cite pas AROME, le modèle le plus fiable à courte échéance sur la Côte d'Opale.
- [wissant-berck] Le « 0/10 Windext » et la mention « secteur interdit sur la fiche » ne sont pas vérifiables, et les fiches sont elles-mêmes au statut « seed ». Le fond reste juste : un vent de NE est side-off/offshore à Berck.
- [wissant-berck] Le passage à l'est entre 10 et 12 h à Wissant est confirmé par AROME (84° à 10 h, 65° à 11 h).
- [wissant-berck] Il ne donne pas les marées : à Berck, basse mer à 11 h 38 et pleine mer à 17 h 12, coefficient 32–37. À Wissant, l'estran est large à marée basse et la mer remonte vite près du Blanc-Nez.
- [wissant-berck] Il ne parle ni de l'eau froide d'octobre ni de l'équipement adapté (foil, grande aile) comme solution par petit temps.
- [wissant-berck] Il exige un vent N à NW à Wissant. C'est trop strict : un NNE de 20 à 40° y est side-shore, donc navigable s'il y a assez de force.

## without-windext errors (for reference)
- [tarifa-wing] Langue : la question est posée en espagnol, mais la réponse est en français.
- [tarifa-wing] L'eau à « environ 21 °C » est probablement surestimée. À Tarifa, en octobre, elle tourne plutôt autour de 18-20 °C, et le détroit peut la refroidir par remontée d'eau froide (upwelling). B ne dit rien de la combinaison à prévoir.
- [tarifa-wing] Le conseil « face à la zone de baignade surveillée » est discutable : la surveillance des plages s'arrête généralement mi-septembre, et en octobre il n'y a sans doute plus de sauveteurs.
- [tarifa-wing] Marée : B n'en parle pas du tout, ni horaires ni effet sur la largeur de la plage à Los Lances.
- [tarifa-wing] B ne donne pas l'orientation de la plage (face au SW). Il ne dit pas que le Levante y est side-off et dangereux, ni que la lagune de La Charca est interdite à la navigation.
- [tarifa-wing] Le reste est juste et cohérent avec Open-Meteo : vent moyen de 0 à 5 kn, rafales jusqu'à environ 10 kn, averses entre 6h et 11h, léger vent d'W l'après-midi entre 15h et 18h, houle d'environ 0,7 m d'W.
- [leucate-windsurf] Les chiffres correspondent à Open-Meteo (316-320°, pic à 15,4-17 kn entre 9h et 11h avec 27-29,5 kn de rafales, puis 12-13,5 kn avec 23-26 kn de rafales l'après-midi). Petite imprécision : le créneau 12h-14h est annoncé à 13-14 kn / 24-25 kn, alors qu'à 11h il y a encore 14,4 kn et 29,5 kn de rafales.
- [leucate-windsurf] Le coucher du soleil est donné « vers 18h45 ». Open-Meteo indique environ 19h00 le 18/10. L'écart est faible et reste prudent.
- [leucate-windsurf] Après avoir dit d'aller sur l'étang, la réponse ne cite aucun spot ni aucune mise à l'eau précise (Le Goulet, base de l'étang, etc.).
- [leucate-windsurf] Le tableau donne une ligne à 20h « nuit tombée », ce qui n'apporte rien. Quelques redondances et un emoji.
- [leucate-windsurf] Les rafales sont présentées comme le double de la moyenne. C'est correct, mais il manque le rappel que la Tramontane forcit souvent l'après-midi, en contradiction avec la tendance du modèle. Ce point est en partie couvert par l'avertissement sur la sous-estimation.
- [leucate-windsurf] Aucune mention du niveau d'eau ou des hauts-fonds variables de l'étang selon le vent. La marée n'est pas pertinente en Méditerranée (microtidale) : son omission est justifiée pour les deux réponses.
- [cumbuco-week] La réponse est un message d'erreur de la CLI (« Command failed … no stdin data received ») et ne contient aucun contenu destiné au rider.
- [cumbuco-week] Aucun jour ni horaire recommandé pour la semaine du 17/10/2026.
- [cumbuco-week] Aucun élément local : alizés d'E à ESE, side-shore à side-onshore, plus forts l'après-midi en pleine saison (octobre), avec la plage et la lagune de Cauípe comme spots principaux.
- [cumbuco-week] Aucune taille d'aile proposée pour 70 kg : 9 m par défaut, 7 m quand le vent est fort, 12 m le matin ou les jours faibles.
- [cumbuco-week] Ni les marées ni le shore-break ne sont abordés.
- [cumbuco-week] Aucune consigne de sécurité, aucun niveau de confiance de la prévision, et rien pour décider le jour même.
- [garda-windsurf] « faible rotor S/SO » est un emploi incorrect du terme. Un rotor est un tourbillon sous le vent d'un relief, alors qu'il s'agit ici d'une faible brise thermique de sud qui s'installe.
- [garda-windsurf] Le chiffre de 8–12 kn pour l'Ora, avec 50–100 % de nuages, est avancé sans justification et paraît trop optimiste. Dans ces conditions, on attend plutôt 5–8 kn.
- [garda-windsurf] Une maximale de 22 °C est haute pour Torbole mi-octobre par temps couvert. Une valeur de 16–19 °C serait plus vraisemblable.
- [garda-windsurf] Aucune consigne de sécurité : température de l'eau d'environ 16–18 °C et combinaison, rafales du Pelèr, trafic des ferries, risque de pétole loin du bord.
- [garda-windsurf] Le régime de l'Ora en automne n'est pas expliqué (plus courte, souvent inexistante sans soleil), et il manque un critère objectif pour décider le matin même, comme le seuil d'A (« nord > 12 kn vers 7 h » mesuré en direct).
- [garda-windsurf] Réponse en français alors que la question est posée en allemand.
- [garda-windsurf] Points positifs : renvoi à Meteotrentino, la source locale pertinente, et alternatives réalistes (SUP, foil) adaptées à une journée sans vent.
- [capetown-kite] Les chiffres du tableau correspondent bien aux sorties Open-Meteo vérifiées : ECMWF ≈11,5 kn avec rafales à 24,5 kn, ICON ≈12,7 kn avec rafales à 26,6 kn, direction 175–193° de 12 h à 17 h. Le tableau ne signale pas que GFS reste à 8–10 kn avec des rafales de 13–15 kn toute la journée. Ce désaccord entre modèles est le principal facteur d'incertitude, et il est passé sous silence.
- [capetown-kite] La nébulosité est un peu surestimée. ECMWF descend à 64–72 % entre 13 h et 15 h, donc le ciel n'est pas couvert à « 85–100 % jusqu'à 16 h ». Seul GFS reste à 100 %.
- [capetown-kite] Pour lundi, la réponse annonce un vent « O/NO 7–9 kn ». Les modèles donnent plutôt de l'OSO (243–264°), entre 3 et 9 kn selon le modèle et l'heure.
- [capetown-kite] « Plein sud = side/side-on » est approximatif. La plage de Blouberg est orientée à peu près vers l'ouest, donc un vent de 180° y souffle side-shore depuis la gauche. Rien n'est dit sur la dérive vers le nord, vers Melkbos, en cas de casse.
- [capetown-kite] Le texte ne dit pas qu'une rafale à 24–26 kn sous une 12 m, pour 85 kg, est un vrai coup de surpuissance. Il ne conseille ni de garder de la marge sur le depower, ni de vérifier le quick release.
- [capetown-kite] Rien sur l'eau froide du Benguela (environ 12–15 °C en octobre, prévoir une 4/3 ou une 5/4), ni sur les rochers à Kite Beach et Big Bay, ni sur la houle de shorebreak.
- [capetown-kite] Aucune mention de grande planche pour le scénario bas autour de 12–14 kn, alors que c'est ce qu'annonce GFS.
- [dakhla-weekend] Coucher du soleil donné « vers 19h » : faux. À Dakhla (≈15,9°W, heure marocaine UTC+1), le soleil se couche vers 19h35 à la mi-octobre. Les créneaux s'arrêtent donc environ 45 min trop tôt (18h30/18h45) et la consigne de rentrer « avant 19h » repose sur une erreur.
- [dakhla-weekend] Aucune mention de l'orientation du vent par rapport aux spots de la lagune. Sur certains spots de la rive ouest (côté péninsule), le NNE est side-off. Rien non plus sur la règle de ne pas partir si le vent souffle de la plage vers l'eau, ni sur la nécessité de rester dans la zone de secours d'un camp.
- [dakhla-weekend] Rafales de 23–24 nœuds pour 14–15 nœuds de moyenne le matin : c'est un vent très rafaleux (+60 %), mais la réponse ne le relève pas et ne donne aucun seuil de décision chiffré pour le jour même.
- [dakhla-weekend] Rien sur les dangers locaux : coquillages coupants (chaussons), hauts-fonds où il faut marcher loin à marée basse, courant fort près de Dragon Island, température de l'eau ou combinaison.
- [dakhla-weekend] Les horaires de marée viennent de sites de prédiction harmonique (seatemperatu.re, tide-forecast) et sont présentés comme exacts, sans dire qu'ils ne sont pas recalés sur un port de référence officiel. L'heure locale UTC+1 est en revanche correcte.
- [dakhla-weekend] Créneau du samedi matin « possible avec la 9 m » à marée basse : il faudrait au moins préciser qu'à basse mer on doit marcher plusieurs centaines de mètres et que le Speed Spot ne fonctionne qu'à ce moment-là.
- [maui-kite] Il ne parle ni de l'interdiction dans le couloir de la piste de l'aéroport de Kahului (zone de 2 miles sur 1 à Spreckelsville), ni de la limite de hauteur de 125 ft liée à la dérogation FAA. Ce sont des règles essentielles à Kanaha.
- [maui-kite] Rien non plus sur le récif, la plage bondée, l'aide au décollage, ni sur le vent irrégulier près du bord.
- [maui-kite] « Pas de risque de vent du sud ni de pétole » est trop affirmatif pour une prévision faite la veille.
- [maui-kite] Le pic de 15-20 nds (rafales 22-24) est une extrapolation à partir des vents annoncés dans les canaux. Elle est honnêtement présentée comme une estimation, mais les modèles bruts disent 12-13 nds.
- [maui-kite] La règle du 11 h est donnée avec réserve (« à ma connaissance »), alors qu'elle est bien établie par le règlement du comté de Maui.
- [maui-kite] La réponse est un peu longue (tableau et liste de sources), même si tout reste utile.
- [maui-kite] Points justes : dimanche 18 octobre, ENE à environ 70°, side-on sur la plage nord, la 10 m comme aile de la journée avec la 12 m en secours (cohérent pour 75 kg à 12-20 nds), et une règle de décision claire selon le capteur à 11 h.
- [brouwersdam-wing] La question est posée en néerlandais, mais la réponse est en français.
- [brouwersdam-wing] Les données horaires correspondent exactement à Open-Meteo : 08h 8 nœuds / 18 / 38°, 09h 11,5 / 20 / 54°, 10h 10,5 / 20 / 67°, etc. Le lever du soleil vers 8h15 (08:13) est correct. La houle de 1,5 m pour 6 s et la basse mer vers 13–14h (minimum vers 14h) sont aussi correctes.
- [brouwersdam-wing] Aucune mention du froid ni de la combinaison, alors que l'eau est à environ 15,6 °C. Rien non plus sur le fait de ne pas partir seul quand le vent faiblit et devient instable.
- [brouwersdam-wing] La réponse ne parle que d'un seul modèle à maille grossière, sans comparer plusieurs modèles. Elle le reconnaît, mais n'indique pas l'ampleur de l'incertitude.
- [brouwersdam-wing] Elle ne précise pas où mettre à l'eau côté Grevelingen. Elle ne rappelle pas non plus les zones balisées et règles locales du Brouwersdam.
- [brouwersdam-wing] Le seuil « moins de 11–12 nœuds établis à 8h » ne colle pas avec sa propre prévision, qui donne 8 nœuds à 8h. Il vaudrait mieux vérifier vers 9h.
- [brouwersdam-wing] Le conseil d'un foil avant de 1500 cm² ou plus est pertinent à 82 kg par 9–12 nœuds, avec une 6 m à la limite.
- [wissant-berck] Erreur majeure d'orientation : la plage de Berck est orientée ouest (normale à environ 270°). Un vent de 20 à 40° y est donc side-off, pas « parallèle/side-shore ». Il vient de terre, il est turbulent et il pousse vers le large. Le seul créneau vraiment side-shore est la pointe AROME de 15 h, orientée à 348°.
- [wissant-berck] Dire que le vent est « propre et régulier, sans obstacle » à Berck est faux : il traverse la côte et les dunes. Les rafales AROME (13–20 kn pour 8–10 de moyenne) montrent un vent aussi haché qu'à Wissant.
- [wissant-berck] Aucune mise en garde sur le side-off/offshore, le risque de dérive au large ni l'eau froide (environ 14–15 °C mi-octobre, combinaison 4/3 ou 5/4). La réponse envoie le rider sur le spot le moins sûr.
- [wissant-berck] Les chiffres sont vérifiés et corrects : AROME à Berck donne 15,1 kn à 15 h (rafales 20) et 8–10 kn le reste de la journée. ECMWF donne 8 kn à 15 h. À Wissant, AROME prévoit 12 kn de moyenne, 19–22 kn en rafales et un grain le matin (35 kn vers 8–9 h).
- [wissant-berck] Les marées sont correctes : à Berck (maree.info), basse mer à 11 h 38 et pleine mer à 17 h 12. Il manque le coefficient (32–37, mortes-eaux), qui limite le courant.
- [wissant-berck] La comparaison des vagues (0,7 m contre 1,3 m) n'a pas été vérifiée. Elle compte de toute façon peu face au problème de direction.