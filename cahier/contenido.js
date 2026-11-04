/* Contenido didáctico de Cahier.
 * FR: unidades de francés. Cada unidad: g = nivel (0 A0, 1 A1, 2 A2, 3 B1),
 *   v = vocabulario [francés, español], s = frases [francés, español],
 *   q = completar [frase con ___, correcta, [incorrectas]], r = regla corta.
 * ES: unidades de ortografía. g = nivel (0 básico, 1 intermedio, 2 avanzado),
 *   w = [forma correcta, forma incorrecta (varias con |), frase con ___].
 */

const FR = [
  { id: 1, g: 0, t: "Saludos y cortesía",
    tip: "<b>Bonjour</b> sirve para todo el día; <b>bonsoir</b> desde la tarde-noche. <b>Salut</b> es solo entre amigos. En francés se deja un espacio antes de <b>? ! : ;</b>",
    r: "Bonjour todo el día, bonsoir de noche, salut entre amigos.",
    v: [["bonjour", "hola (buenos días)"], ["bonsoir", "buenas noches (al llegar)"], ["salut", "hola (entre amigos)"], ["au revoir", "adiós"], ["merci", "gracias"], ["s'il vous plaît", "por favor"], ["oui", "sí"], ["non", "no"], ["excusez-moi", "disculpe"], ["à bientôt", "hasta pronto"]],
    s: [["Bonjour, comment ça va ?", "Hola, ¿cómo estás?"], ["Ça va bien, merci.", "Estoy bien, gracias."], ["Au revoir et à bientôt !", "¡Adiós y hasta pronto!"], ["Merci beaucoup, madame.", "Muchas gracias, señora."]],
    q: [["Comment ___ va ?", "ça", ["sa", "se"]], ["___ beaucoup !", "Merci", ["Mercy", "Bonjour"]], ["Au ___ !", "revoir", ["revoire", "voir"]]] },

  { id: 2, g: 0, t: "Me presento y cuento",
    tip: "Para la edad se usa <b>avoir</b> (tener): <b>j'ai vingt ans</b>. Para la ciudad, <b>à</b>: <b>j'habite à Paris</b>. Delante de vocal, <b>je</b> se convierte en <b>j'</b>.",
    r: "La edad va con avoir: j'ai vingt ans. Ciudad con à.",
    v: [["un", "uno"], ["deux", "dos"], ["trois", "tres"], ["quatre", "cuatro"], ["cinq", "cinco"], ["dix", "diez"], ["vingt", "veinte"], ["je m'appelle", "me llamo"], ["j'habite", "vivo"], ["j'ai vingt ans", "tengo veinte años"]],
    s: [["Je m'appelle Marie.", "Me llamo Marie."], ["J'ai vingt ans.", "Tengo veinte años."], ["J'habite à Paris.", "Vivo en París."], ["Tu t'appelles comment ?", "¿Cómo te llamas?"]],
    q: [["J'___ vingt ans.", "ai", ["suis", "as"]], ["Je m'___ Paul.", "appelle", ["appele", "apelle"]], ["J'habite ___ Lyon.", "à", ["en", "au"]]] },

  { id: 3, g: 0, t: "Ser y los artículos",
    tip: "<b>Être</b>: je suis, tu es, il/elle est, nous sommes, vous êtes, ils/elles sont. Artículos: <b>le</b> (masc.), <b>la</b> (fem.), <b>les</b> (plural); <b>un / une / des</b>.",
    r: "Être: je suis, tu es, il est, nous sommes, vous êtes, ils sont.",
    v: [["je suis", "yo soy"], ["tu es", "tú eres"], ["il est", "él es"], ["elle est", "ella es"], ["nous sommes", "nosotros somos"], ["vous êtes", "usted es / ustedes son"], ["ils sont", "ellos son"], ["le garçon", "el chico"], ["la fille", "la chica"], ["les amis", "los amigos"]],
    s: [["Je suis dominicain.", "Soy dominicano."], ["Elle est professeure.", "Ella es profesora."], ["Nous sommes amis.", "Somos amigos."], ["Vous êtes français ?", "¿Usted es francés?"]],
    q: [["Nous ___ contents.", "sommes", ["sont", "êtes"]], ["___ fille est grande.", "La", ["Le", "Les"]], ["Ils ___ à la maison.", "sont", ["est", "sommes"]], ["J'ai ___ chat.", "un", ["une", "des"]]] },

  { id: 4, g: 0, t: "Tener y la familia",
    tip: "<b>Avoir</b>: j'ai, tu as, il a, nous avons, vous avez, ils ont. Posesivos: <b>mon</b> père, <b>ma</b> mère, <b>mes</b> parents.",
    r: "Avoir: j'ai, tu as, il a, nous avons, vous avez, ils ont. Mon/ma/mes.",
    v: [["la mère", "la madre"], ["le père", "el padre"], ["le frère", "el hermano"], ["la sœur", "la hermana"], ["le fils", "el hijo"], ["la fille", "la hija"], ["les grands-parents", "los abuelos"], ["j'ai", "tengo"], ["tu as", "tienes"], ["ils ont", "ellos tienen"]],
    s: [["J'ai deux frères.", "Tengo dos hermanos."], ["Ma sœur a dix ans.", "Mi hermana tiene diez años."], ["Mon père est médecin.", "Mi padre es médico."], ["Nous avons un chien.", "Tenemos un perro."]],
    q: [["Tu ___ des enfants ?", "as", ["a", "es"]], ["___ mère est gentille.", "Ma", ["Mon", "Mes"]], ["Ils ___ une grande maison.", "ont", ["sont", "avons"]], ["Nous ___ un chien.", "avons", ["avez", "ont"]]] },

  { id: 5, g: 1, t: "Comida y verbos en -er",
    tip: "Verbos en -er: je mange, tu manges, il mange, nous <b>mangeons</b>, vous mangez, ils mangent. Para cantidades sin contar: <b>du</b> pain, <b>de la</b> viande, <b>de l'</b>eau.",
    r: "Partitivo: du (masc.), de la (fem.), de l' (vocal), des (plural).",
    v: [["manger", "comer"], ["boire", "beber"], ["le pain", "el pan"], ["le fromage", "el queso"], ["l'eau", "el agua"], ["le café", "el café"], ["la pomme", "la manzana"], ["le poulet", "el pollo"], ["aimer", "gustar / amar"], ["l'addition", "la cuenta"]],
    s: [["J'aime le fromage.", "Me gusta el queso."], ["Nous mangeons du pain.", "Comemos pan."], ["Je voudrais un café, s'il vous plaît.", "Quisiera un café, por favor."], ["L'addition, s'il vous plaît.", "La cuenta, por favor."]],
    q: [["Tu ___ le chocolat ?", "aimes", ["aime", "aimez"]], ["Je bois ___ eau.", "de l'", ["du", "de la"]], ["Vous ___ du poisson ?", "mangez", ["mangeons", "mange"]], ["Nous ___ au restaurant.", "mangeons", ["mangons", "mangez"]]] },

  { id: 6, g: 1, t: "La ciudad y el verbo aller",
    tip: "<b>Aller</b>: je vais, tu vas, il va, nous allons, vous allez, ils vont. <b>à + le = au</b> (au cinéma), <b>à la</b> plage, <b>à l'</b>école.",
    r: "à + le = au. Aller: je vais, tu vas, il va, nous allons, vous allez, ils vont.",
    v: [["la gare", "la estación de tren"], ["la rue", "la calle"], ["la boulangerie", "la panadería"], ["la plage", "la playa"], ["l'hôpital", "el hospital"], ["à gauche", "a la izquierda"], ["à droite", "a la derecha"], ["tout droit", "todo recto"], ["je vais", "voy"], ["on va", "vamos (informal)"]],
    s: [["Je vais à la plage.", "Voy a la playa."], ["Où est la gare ?", "¿Dónde está la estación?"], ["Tournez à gauche.", "Gire a la izquierda."], ["Nous allons au cinéma.", "Vamos al cine."]],
    q: [["Je vais ___ cinéma.", "au", ["à le", "à la"]], ["Ils ___ à Paris.", "vont", ["allent", "vais"]], ["Tu vas ___ école ?", "à l'", ["au", "à la"]], ["Nous ___ à la boulangerie.", "allons", ["allez", "vont"]]] },

  { id: 7, g: 1, t: "Mi rutina y la hora",
    tip: "Verbos pronominales: je <b>me</b> lève, tu <b>te</b> lèves, il <b>se</b> lève, nous <b>nous</b> levons, vous <b>vous</b> levez. La hora: <b>il est sept heures</b> (son las siete).",
    r: "Me, te, se, nous, vous: el pronombre cambia con la persona.",
    v: [["se lever", "levantarse"], ["se coucher", "acostarse"], ["se doucher", "ducharse"], ["le matin", "la mañana"], ["le soir", "la noche (tarde-noche)"], ["quelle heure est-il ?", "¿qué hora es?"], ["midi", "mediodía"], ["toujours", "siempre"], ["souvent", "a menudo"], ["d'abord", "primero"]],
    s: [["Je me lève à sept heures.", "Me levanto a las siete."], ["Il est huit heures et demie.", "Son las ocho y media."], ["Elle se couche tard.", "Ella se acuesta tarde."], ["D'abord, je me douche.", "Primero, me ducho."]],
    q: [["Je ___ lève tôt.", "me", ["se", "te"]], ["Nous ___ couchons à minuit.", "nous", ["se", "vous"]], ["Il est neuf ___.", "heures", ["heure", "ans"]], ["Tu ___ douches le soir ?", "te", ["se", "me"]]] },

  { id: 8, g: 1, t: "Negar y preguntar",
    tip: "La negación rodea al verbo: <b>ne</b> parle <b>pas</b>. También <b>ne… jamais</b> (nunca), <b>ne… plus</b> (ya no). Después de negación, <b>du/de la/un</b> pasan a <b>de / d'</b>.",
    r: "Ne + verbo + pas. Tras negación: pas de / pas d'.",
    v: [["ne pas", "no"], ["ne jamais", "nunca"], ["ne plus", "ya no"], ["rien", "nada"], ["pourquoi", "por qué"], ["parce que", "porque"], ["quand", "cuándo"], ["où", "dónde"], ["qui", "quién"], ["combien", "cuánto"]],
    s: [["Je ne parle pas anglais.", "No hablo inglés."], ["Il ne mange jamais de viande.", "Él nunca come carne."], ["Est-ce que tu viens ?", "¿Vienes?"], ["Combien ça coûte ?", "¿Cuánto cuesta?"]],
    q: [["Je ne fume ___.", "pas", ["non", "rien"]], ["Je n'ai pas ___ argent.", "d'", ["de l'", "du"]], ["___ est-ce que tu habites ?", "Où", ["Ou", "Qui"]], ["Elle ne travaille ___ ici, elle est partie.", "plus", ["jamais", "rien"]]] },

  { id: 9, g: 1, t: "Describir con adjetivos",
    tip: "El adjetivo concuerda: petit → <b>petite</b> → petits → <b>petites</b>. Algunos cambian más: beau → <b>belle</b>, vieux → <b>vieille</b>, blanc → <b>blanche</b>, gentil → <b>gentille</b>.",
    r: "Femenino +e, plural +s. Ojo: beau/belle, vieux/vieille, gentil/gentille.",
    v: [["grand", "grande / alto"], ["petite", "pequeña"], ["belle", "bonita"], ["nouveau", "nuevo"], ["heureuse", "feliz (ella)"], ["gentil", "amable"], ["vieille", "vieja"], ["cher", "caro"], ["intéressant", "interesante"], ["fatigué", "cansado"]],
    s: [["Ma maison est petite.", "Mi casa es pequeña."], ["C'est une belle ville.", "Es una ciudad bonita."], ["Elles sont très heureuses.", "Ellas están muy felices."], ["J'ai une nouvelle voiture.", "Tengo un carro nuevo."]],
    q: [["Elle est très ___.", "gentille", ["gentil", "gentils"]], ["Mes sœurs sont ___.", "fatiguées", ["fatigué", "fatigués"]], ["Une maison ___.", "blanche", ["blanc", "blanches"]], ["C'est une ___ idée.", "bonne", ["bon", "bons"]]] },

  { id: 10, g: 1, t: "Lo que voy a hacer",
    tip: "Futuro cercano = <b>aller + infinitivo</b>, igual que en español: <b>je vais voyager</b> (voy a viajar). El segundo verbo no se conjuga.",
    r: "Aller conjugado + verbo en infinitivo: je vais regarder.",
    v: [["demain", "mañana"], ["ce soir", "esta noche"], ["la semaine prochaine", "la próxima semana"], ["voyager", "viajar"], ["acheter", "comprar"], ["regarder", "mirar"], ["visiter", "visitar"], ["le week-end", "el fin de semana"], ["bientôt", "pronto"], ["faire", "hacer"]],
    s: [["Je vais voyager en France.", "Voy a viajar a Francia."], ["Demain, nous allons visiter le musée.", "Mañana vamos a visitar el museo."], ["Qu'est-ce que tu vas faire ce soir ?", "¿Qué vas a hacer esta noche?"], ["Ils vont acheter une maison.", "Van a comprar una casa."]],
    q: [["Je vais ___ un film.", "regarder", ["regarde", "regardé"]], ["Elle ___ partir demain.", "va", ["vais", "vont"]], ["Vous ___ dîner avec nous ?", "allez", ["allons", "vas"]], ["Nous allons ___ nos amis.", "voir", ["voyons", "vu"]]] },

  { id: 11, g: 2, t: "El pasado con avoir",
    tip: "Passé composé = <b>avoir + participio</b>: j'ai mangé, tu as fini, il a pris. Participios irregulares clave: <b>fait, vu, bu, pris, eu, été</b>.",
    r: "Avoir conjugado + participio: j'ai mangé, nous avons vu.",
    v: [["j'ai mangé", "comí"], ["j'ai fini", "terminé"], ["j'ai pris", "tomé"], ["j'ai fait", "hice"], ["j'ai vu", "vi"], ["j'ai bu", "bebí"], ["hier", "ayer"], ["la semaine dernière", "la semana pasada"], ["déjà", "ya"], ["il y a deux jours", "hace dos días"]],
    s: [["Hier, j'ai mangé une pizza.", "Ayer comí una pizza."], ["Nous avons vu un bon film.", "Vimos una buena película."], ["Tu as fini tes devoirs ?", "¿Terminaste tus tareas?"], ["Ils ont pris le train.", "Tomaron el tren."]],
    q: [["J'ai ___ mes clés.", "perdu", ["perdé", "perdi"]], ["Elle a ___ un gâteau.", "fait", ["faite", "fais"]], ["Nous ___ bu du vin.", "avons", ["sommes", "ont"]], ["Tu as ___ mon message ?", "vu", ["vois", "voi"]]] },

  { id: 12, g: 2, t: "El pasado con être",
    tip: "Los verbos de movimiento (aller, venir, partir, arriver, naître, rester, tomber…) usan <b>être</b>, y el participio concuerda: elle est allé<b>e</b>, nous sommes arrivé<b>s</b>.",
    r: "Verbos de movimiento con être; el participio concuerda: elle est partie.",
    v: [["je suis allé", "fui"], ["je suis venu", "vine"], ["je suis parti", "me fui"], ["je suis arrivé", "llegué"], ["je suis né", "nací"], ["je suis resté", "me quedé"], ["je suis tombé", "me caí"], ["elle est sortie", "ella salió"], ["nous sommes rentrés", "volvimos a casa"], ["il est mort", "murió"]],
    s: [["Elle est allée au marché.", "Ella fue al mercado."], ["Je suis né à Santiago.", "Nací en Santiago."], ["Nous sommes arrivés en retard.", "Llegamos tarde."], ["Ils sont restés à la maison.", "Se quedaron en casa."]],
    q: [["Elle est ___ hier.", "partie", ["parti", "partis"]], ["Nous ___ allés à la plage.", "sommes", ["avons", "sont"]], ["Marie et Julie sont ___.", "venues", ["venu", "venus"]], ["Il ___ tombé dans la rue.", "est", ["a", "ai"]]] },

  { id: 13, g: 2, t: "Lo, la, le, les",
    tip: "Complemento directo: <b>le, la, les</b> (lo, la, los). Indirecto, con «à»: <b>lui</b> (a él / a ella) y <b>leur</b> (a ellos). Van delante del verbo: je <b>la</b> connais.",
    r: "Directo: le, la, les. Con «à alguien»: lui (singular), leur (plural).",
    v: [["je le vois", "lo veo"], ["je la connais", "la conozco"], ["je les aime", "los quiero"], ["je lui parle", "le hablo"], ["je leur écris", "les escribo"], ["appeler", "llamar"], ["inviter", "invitar"], ["aider", "ayudar"], ["répondre", "responder"], ["donner", "dar"]],
    s: [["Je la connais bien.", "La conozco bien."], ["Tu le vois demain ?", "¿Lo ves mañana?"], ["Je lui téléphone ce soir.", "Le llamo esta noche."], ["Nous les invitons.", "Los invitamos."]],
    q: [["Tu connais Paul ? Oui, je ___ connais.", "le", ["lui", "la"]], ["J'écris à ma mère. Je ___ écris.", "lui", ["la", "leur"]], ["Tu aimes ces livres ? Oui, je ___ aime.", "les", ["leur", "lui"]], ["Je parle à mes amis. Je ___ parle.", "leur", ["les", "lui"]]] },

  { id: 14, g: 2, t: "Cuando era pequeño",
    tip: "El <b>imparfait</b> describe costumbres y escenas del pasado (como «jugaba», «hacía»). Se forma con la raíz de nous: nous jou-ons → je <b>jouais</b>. Excepción: être → <b>j'étais</b>.",
    r: "Imparfait para costumbres y descripciones: je jouais, il faisait, j'étais.",
    v: [["j'étais", "era / estaba"], ["j'avais", "tenía"], ["il faisait beau", "hacía buen tiempo"], ["quand j'étais petit", "cuando era pequeño"], ["d'habitude", "normalmente"], ["chaque été", "cada verano"], ["on jouait", "jugábamos"], ["il pleuvait", "llovía"], ["nous habitions", "vivíamos"], ["autrefois", "antes (antiguamente)"]],
    s: [["Quand j'étais petit, je jouais au foot.", "Cuando era pequeño, jugaba fútbol."], ["Il faisait très chaud.", "Hacía mucho calor."], ["Nous habitions près de la mer.", "Vivíamos cerca del mar."], ["Chaque été, on allait chez ma grand-mère.", "Cada verano íbamos a casa de mi abuela."]],
    q: [["Quand j'___ jeune, j'aimais danser.", "étais", ["ai été", "suis"]], ["Il ___ quand je suis sorti.", "pleuvait", ["a plu", "pleut"]], ["Avant, nous ___ souvent au parc.", "allions", ["allons", "irons"]], ["Avant, tu ___ les cheveux longs.", "avais", ["as eu", "avez"]]] },

  { id: 15, g: 3, t: "Futuro y condicional",
    tip: "<b>Futur simple</b>: infinitivo + -ai, -as, -a, -ons, -ez, -ont (je parlerai). Irregulares: <b>serai, aurai, irai, ferai, pourrai</b>. <b>Conditionnel</b> = misma raíz + -ais: je voudrais. «Si + imparfait» lleva condicional: si j'avais…, je voyagerais.",
    r: "Si + imparfait → conditionnel. Quand + futur → futur.",
    v: [["je serai", "seré"], ["j'aurai", "tendré"], ["j'irai", "iré"], ["je ferai", "haré"], ["je pourrai", "podré"], ["je voudrais", "quisiera"], ["j'aimerais", "me gustaría"], ["si j'avais", "si tuviera"], ["je serais", "sería"], ["l'année prochaine", "el próximo año"]],
    s: [["L'année prochaine, j'irai au Canada.", "El próximo año iré a Canadá."], ["Si j'avais le temps, je voyagerais plus.", "Si tuviera tiempo, viajaría más."], ["J'aimerais apprendre le piano.", "Me gustaría aprender piano."], ["Nous ferons la fête samedi.", "Haremos la fiesta el sábado."]],
    q: [["Demain, il ___ beau.", "fera", ["fait", "faisait"]], ["Si j'avais de l'argent, j'___ une maison.", "achèterais", ["achèterai", "achète"]], ["Quand tu ___ à Paris, appelle-moi.", "seras", ["es", "serais"]], ["L'année prochaine, nous ___ en Italie.", "irons", ["irez", "allerons"]]] },

  { id: 16, g: 3, t: "Opinar y conectar ideas",
    tip: "Tras <b>il faut que</b>, <b>je veux que</b> o <b>bien que</b> va el <b>subjuntivo</b>: que tu fasses, que vous soyez, qu'il vienne. Tras <b>je pense que</b> va indicativo. Conectores: <b>donc</b> (por lo tanto), <b>pourtant</b> (sin embargo).",
    r: "Il faut que / je veux que / bien que + subjuntivo. Je pense que + indicativo.",
    v: [["il faut que", "es necesario que"], ["je pense que", "creo que"], ["à mon avis", "en mi opinión"], ["pourtant", "sin embargo"], ["donc", "por lo tanto"], ["cependant", "no obstante"], ["bien que", "aunque"], ["afin de", "con el fin de"], ["d'ailleurs", "además / por cierto"], ["je ne pense pas que", "no creo que"]],
    s: [["Il faut que tu viennes.", "Es necesario que vengas."], ["À mon avis, c'est une bonne idée.", "En mi opinión, es una buena idea."], ["Il pleut, pourtant il fait chaud.", "Llueve; sin embargo, hace calor."], ["Bien qu'il soit tard, je travaille.", "Aunque es tarde, trabajo."]],
    q: [["Il faut que tu ___ tes devoirs.", "fasses", ["fais", "feras"]], ["Je veux que vous ___ à l'heure.", "soyez", ["êtes", "serez"]], ["Il est malade, ___ il reste à la maison.", "donc", ["pourtant", "bien que"]], ["Je pense qu'il ___ raison.", "a", ["ait", "avoir"]]] },
];

const ES = [
  { id: 1, g: 0, t: "Mayúsculas y signos",
    tip: "Preguntas y exclamaciones <b>abren y cierran</b>: ¿…? ¡…! Nombres propios y lugares van con mayúscula; <b>días, meses, idiomas y gentilicios van en minúscula</b>: lunes, enero, español, dominicanos.",
    r: "¿? y ¡! siempre en pareja. Días, meses e idiomas en minúscula.",
    w: [["¿Cómo", "Cómo", "___ estás?"], ["¡Qué", "Qué", "___ alegría verte!"], ["Santo Domingo", "santo domingo", "Vivo en ___."], ["lunes", "Lunes", "Nos vemos el ___."], ["enero", "Enero", "Mi cumpleaños es en ___."], ["español", "Español", "Hablo ___ y francés."], ["Juan", "juan", "Mi hermano se llama ___."], ["dominicanos", "Dominicanos", "Los ___ somos alegres."], ["¿Dónde", "Dónde", "___ queda el banco?"], ["Biblia", "biblia", "Leo la ___ cada mañana."]] },

  { id: 2, g: 0, t: "B y V",
    tip: "Pistas que no fallan: después de <b>m</b> va <b>b</b> (también, cambio); después de <b>n</b> va <b>v</b> (invierno, enviar). El copretérito <b>-aba</b> siempre con b (hablaba). Las terminaciones <b>-ble</b> y <b>-bilidad</b> van con b.",
    r: "mb y nv. -aba con b. -ble con b.",
    w: [["vaso", "baso", "Sírveme un ___ de agua."], ["bueno", "vueno", "El café está muy ___."], ["hablaba", "hablava", "Ella ___ por teléfono."], ["llevar", "llebar", "Tengo que ___ a mi hijo."], ["biblioteca", "viblioteca", "Estudio en la ___."], ["nuevo", "nuebo", "Compré un carro ___."], ["obvio", "ovbio", "Es ___ que vendrá."], ["vivir", "bivir", "Quiero ___ cerca del mar."], ["amable", "amavle", "Es una persona muy ___."], ["invierno", "imbierno", "En ___ hace frío."]] },

  { id: 3, g: 0, t: "La H",
    tip: "La h no suena, por eso se olvida. Llevan h las palabras que empiezan por <b>hie-, hue-, hui-</b> (hielo, huevo, huir) y las formas de <b>haber</b> y <b>hacer</b>. Ojo con <b>ola</b> (del mar) y <b>hola</b> (saludo).",
    r: "hie-, hue-, hui- llevan h. Hacer y haber siempre con h.",
    w: [["hoy", "oy", "___ es lunes."], ["hacer", "acer", "Voy a ___ la tarea."], ["hielo", "yelo", "Ponle ___ al jugo."], ["ahora", "aora", "Ven ___ mismo."], ["huevo", "güevo", "Desayuné un ___ frito."], ["hermano", "ermano", "Mi ___ toca guitarra."], ["almohada", "almoada", "Necesito otra ___."], ["zanahoria", "zanaoria", "La ___ es naranja."], ["ola", "hola", "Una ___ gigante llegó a la playa."], ["hola", "ola", "___, ¿qué tal?"]] },

  { id: 4, g: 0, t: "G y J",
    tip: "Con e/i la g y la j suenan igual. Van con <b>j</b>: el pretérito de decir y traer (<b>dije, traje</b>) y las palabras en <b>-aje</b> (viaje). Van con <b>g</b>: los verbos en <b>-ger, -gir</b> (elegir) y <b>gen-</b> (gente). Para que suene la u en güe/güi se usa diéresis: pingüino.",
    r: "-aje con j; -ger/-gir con g; dije y traje con j.",
    w: [["gente", "jente", "Había mucha ___."], ["mujer", "muger", "Esa ___ es doctora."], ["viaje", "viage", "El ___ fue largo."], ["dije", "dige", "Ya te lo ___."], ["imagen", "imajen", "La ___ está borrosa."], ["general", "jeneral", "En ___, me gusta."], ["traje", "trage", "Me puse un ___ azul."], ["tejer", "teger", "Mi abuela sabe ___."], ["elegir", "elejir", "Es difícil ___."], ["pingüino", "pinguino", "El ___ vive en el frío."]] },

  { id: 5, g: 0, t: "LL e Y",
    tip: "En el Caribe suenan casi igual. Van con <b>ll</b> las terminaciones <b>-illo, -illa</b> (silla) y <b>-alle, -elle</b> (calle). Va con <b>y</b> la palabra que termina en sonido «i» tras vocal (rey, hoy) y formas de verbos sin ll en el infinitivo (cayó, de caer).",
    r: "-illo/-illa con ll. Final «i» tras vocal se escribe y: rey.",
    w: [["llave", "yave", "Perdí la ___ de la casa."], ["playa", "plalla", "Vamos a la ___."], ["calle", "caye", "Vivo en esta ___."], ["yo", "llo", "___ soy de Santiago."], ["ayer", "aller", "___ llovió mucho."], ["caballo", "cabayo", "El ___ corre rápido."], ["rey", "rei", "El ___ y la reina."], ["lluvia", "yuvia", "Me encanta la ___."], ["joya", "jolla", "Esa ___ es de oro."], ["silla", "siya", "Siéntate en la ___."]] },

  { id: 6, g: 0, t: "C, S y Z",
    tip: "Con el seseo, c, s y z suenan igual. Regla útil: la <b>z cambia a c</b> delante de e/i (lápiz → lápi<b>c</b>es, vez → ve<b>c</b>es). Los verbos en <b>-cer, -cir</b> se escriben con c (conocer). Si dudas, busca la familia: cabeza → cabezón.",
    r: "z → c delante de e/i: lápices, veces. -cer y -cir con c.",
    w: [["zapato", "sapato", "Me duele el ___."], ["cielo", "sielo", "El ___ está azul."], ["cocinar", "cosinar", "Me gusta ___."], ["lápices", "lápizes", "Compré tres ___."], ["feliz", "felis", "Estoy muy ___."], ["veces", "vezes", "Lo intenté muchas ___."], ["cereza", "seresa", "Una ___ roja."], ["sencillo", "cencillo", "Es un ejercicio ___."], ["conocer", "conoser", "Quiero ___ París."], ["cabeza", "cabesa", "Me duele la ___."]] },

  { id: 7, g: 1, t: "Agudas, llanas y esdrújulas",
    tip: "<b>Agudas</b> (fuerza al final) llevan tilde si terminan en <b>n, s o vocal</b>: canción, café. <b>Llanas</b> (penúltima) llevan tilde si <b>no</b> terminan en n, s o vocal: árbol, lápiz. <b>Esdrújulas</b>, siempre: música, teléfono.",
    r: "Aguda: tilde si acaba en n, s o vocal. Llana: al revés. Esdrújula: siempre.",
    w: [["canción", "cancion", "Esa ___ es preciosa."], ["árbol", "arbol", "El ___ da sombra."], ["música", "musica", "Me encanta la ___."], ["examen", "exámen", "Mañana tengo ___."], ["café", "cafe", "Un ___ con leche."], ["lápiz", "lapiz", "Préstame un ___."], ["teléfono", "telefono", "Contesta el ___."], ["joven", "jóven", "Es un hombre ___."], ["rápido", "rapido", "Corre muy ___."], ["virus", "vírus", "El ___ se propagó."], ["exámenes", "examenes", "Los ___ fueron difíciles."], ["reloj", "relój", "Mi ___ se paró."]] },

  { id: 8, g: 1, t: "Tilde diacrítica",
    tip: "Las palabras de una sílaba no llevan tilde, salvo para distinguir significados: <b>tú</b> (persona) / tu (posesivo), <b>él</b> / el, <b>más</b> (cantidad) / mas (pero), <b>sí</b> (afirmación) / si (condición), <b>mí</b> / mi, <b>té</b> (bebida) / te, <b>sé</b> (saber) / se.",
    r: "Tú, él, mí, sí, más, té, sé: con tilde cuando son pronombre, afirmación, cantidad o verbo.",
    w: [["tú", "tu", "¿___ vienes a la fiesta?"], ["tu", "tú", "¿Dónde está ___ carro?"], ["él", "el", "___ es mi amigo."], ["el", "él", "Abre ___ libro."], ["más", "mas", "Quiero ___ arroz."], ["sí", "si", "Le dije que ___."], ["si", "sí", "___ llueve, no salgo."], ["mí", "mi", "Esto es para ___."], ["té", "te", "Me tomé un ___ de jengibre."], ["sé", "se", "No ___ la respuesta."]] },

  { id: 9, g: 1, t: "Por qué, porque, porqué",
    tip: "<b>¿Por qué?</b> pregunta (directa o indirecta: no sé por qué). <b>Porque</b> responde o explica la causa. <b>El porqué</b> es un sustantivo (= el motivo). <b>Por que</b> = por el cual / por la que.",
    r: "Por qué pregunta, porque responde, el porqué es el motivo.",
    w: [["por qué", "porque", "¿___ llegaste tarde?"], ["porque", "por qué", "Llegué tarde ___ había tapón."], ["porqué", "por qué", "No entiendo el ___ de su decisión."], ["por qué", "porque", "No sé ___ se fue."], ["porque", "porqué", "Estudio ___ quiero aprender."], ["por qué", "porqué", "¿___ no me llamaste?"], ["porqué", "porque", "Explícame el ___ de todo."], ["por que", "porque", "Esa es la razón ___ me fui."], ["porque", "por qué", "Me voy ___ ya es tarde."], ["por qué", "porque", "¿Sabes ___ cerraron?"]] },

  { id: 10, g: 1, t: "Haber, a ver, hay, ahí, hecho",
    tip: "<b>A ver</b> = mirar o comprobar (vamos a ver). <b>Haber</b> es verbo (debe haber). <b>Hay</b> = existe; <b>ahí</b> = lugar; <b>¡ay!</b> = queja. <b>Hecho</b> viene de hacer; <b>echo</b> viene de echar.",
    r: "A ver = mirar. Haber = verbo. Hay existe, ahí lugar, ay dolor. Hecho de hacer, echo de echar.",
    w: [["a ver", "haber", "Vamos ___ la película."], ["haber", "a ver", "Debe ___ un error."], ["hay", "ahí", "No ___ leche en la nevera."], ["ahí", "hay", "Pon la caja ___."], ["ay", "hay", "¡___, qué dolor!"], ["hecho", "echo", "Ya he ___ la tarea."], ["echo", "hecho", "Siempre le ___ sal al arroz."], ["a ver", "haber", "___ si mañana nos vemos."], ["haber", "a ver", "Podría ___ más gente."], ["hecho", "echo", "Es un ___ histórico."]] },

  { id: 11, g: 2, t: "Hiatos y diptongos",
    tip: "Cuando la <b>i</b> o la <b>u</b> suenan fuertes junto a otra vocal, se rompe el diptongo y <b>llevan tilde siempre</b>: día, país, baúl. Los monosílabos como <b>fui, fue, dio, vio</b> y la palabra <b>guion</b> no llevan tilde.",
    r: "í/ú tónicas junto a a, e, o llevan tilde siempre: día, país. Fui, dio y guion, sin tilde.",
    w: [["día", "dia", "Hoy es un buen ___."], ["país", "pais", "Mi ___ es hermoso."], ["baúl", "baul", "Guarda la ropa en el ___."], ["río", "rio", "El ___ está crecido."], ["maíz", "maiz", "Me gusta el ___ asado."], ["oído", "oido", "Me duele el ___."], ["Raúl", "Raul", "___ es mi primo."], ["policía", "policia", "Llama a la ___."], ["fui", "fuí", "Ayer ___ al banco."], ["guion", "guión", "Escribí el ___ del video."], ["huir", "huír", "Quiso ___ del peligro."], ["heroína", "heroina", "Ella es una ___."]] },

  { id: 12, g: 2, t: "Qué, cuándo, dónde, cómo",
    tip: "Llevan tilde cuando <b>preguntan o exclaman</b>, aunque no haya signos: «no sé <b>qué</b> quieres», «pregúntale <b>dónde</b> vive». Sin tilde cuando <b>conectan</b>: «dijo que vendría», «la casa donde nací».",
    r: "Si pregunta o exclama, lleva tilde (aunque no tenga ¿?).",
    w: [["qué", "que", "No sé ___ quieres."], ["que", "qué", "Dijo ___ vendría."], ["cuándo", "cuando", "¿___ es tu cumpleaños?"], ["cuando", "cuándo", "Llámame ___ llegues."], ["dónde", "donde", "Pregúntale ___ vive."], ["donde", "dónde", "Esta es la casa ___ nací."], ["cómo", "como", "No entiendo ___ funciona."], ["como", "cómo", "Hazlo ___ te enseñé."], ["quién", "quien", "¿___ llamó?"], ["cuánto", "cuanto", "¡___ te quiero!"]] },

  { id: 13, g: 2, t: "X y las terminaciones -ción, -sión",
    tip: "Se escriben con <b>x</b> las palabras con <b>ex-</b> (fuera de, excelente) y <b>extra-</b>. Truco para -ción / -sión: si existe una palabra de la familia con <b>-to, -tor, -do</b>, va <b>-ción</b> (atento → atención); si tiene <b>-so, -sor, -sivo</b>, va <b>-sión</b> (confuso → confusión).",
    r: "-to/-tor → -ción. -so/-sor/-sivo → -sión.",
    w: [["examen", "ecsamen", "Aprobé el ___."], ["explicar", "esplicar", "Te lo voy a ___."], ["extranjero", "estranjero", "Viajó al ___."], ["acción", "acsión", "Es una película de ___."], ["televisión", "televición", "Apaga la ___."], ["decisión", "decición", "Fue una buena ___."], ["atención", "atensión", "Presta ___."], ["dirección", "direción", "¿Cuál es tu ___?"], ["excelente", "ecselente", "¡Trabajo ___!"], ["confusión", "confución", "Hubo una ___."], ["estrategia", "extrategia", "Necesitamos una ___ digital."]] },

  { id: 14, g: 2, t: "Homófonos",
    tip: "Suenan igual y significan distinto. <b>Valla</b> (cerca) / <b>vaya</b> (de ir, o sorpresa). <b>Tuvo</b> (tener) / <b>tubo</b> (cilindro). <b>Cayó</b> (caer) / <b>calló</b> (callar). <b>Votar</b> (elecciones) / <b>botar</b> (tirar). <b>Cien</b> (100) / <b>sien</b> (cabeza).",
    r: "Piensa de qué palabra viene: tener → tuvo, caer → cayó, callar → calló.",
    w: [["valla", "vaya", "Saltó la ___ del patio."], ["vaya", "valla", "¡___ sorpresa!"], ["tuvo", "tubo", "Ella ___ un bebé."], ["tubo", "tuvo", "Se rompió el ___ del agua."], ["calló", "cayó", "Cuando entré, todo el mundo se ___."], ["cayó", "calló", "La lluvia ___ toda la noche."], ["votar", "botar", "Mañana vamos a ___ en las elecciones."], ["botar", "votar", "No hay que ___ basura en la calle."], ["cien", "sien", "Tengo ___ pesos."], ["sien", "cien", "Me duele la ___."], ["haya", "halla", "Espero que ___ comida."]] },
];

/* Prueba de nivel: g = grupo de nivel; se avanza grupo a grupo y se para al fallar uno. */
const PLACE_FR = [
  { g: 0, q: "¿Cómo se dice «gracias» en francés?", ok: "merci", no: ["bonjour", "pardon"] },
  { g: 0, q: "Je ___ dominicain.", ok: "suis", no: ["es", "ai"] },
  { g: 0, q: "¿Qué significa «au revoir»?", ok: "adiós", no: ["buenos días", "por favor"] },
  { g: 1, q: "Nous ___ du pain.", ok: "mangeons", no: ["mangez", "mange"] },
  { g: 1, q: "Je vais ___ cinéma.", ok: "au", no: ["à le", "en"] },
  { g: 1, q: "Je ne parle ___ anglais.", ok: "pas", no: ["non", "rien"] },
  { g: 2, q: "Hier, j'___ un film.", ok: "ai vu", no: ["vois", "verrai"] },
  { g: 2, q: "Elle est ___ à Paris la semaine dernière.", ok: "allée", no: ["allé", "aller"] },
  { g: 2, q: "Quand j'étais petit, je ___ au foot tous les jours.", ok: "jouais", no: ["ai joué", "jouerai"] },
  { g: 3, q: "Si j'avais le temps, je ___ plus.", ok: "voyagerais", no: ["voyagerai", "voyage"] },
  { g: 3, q: "Il faut que tu ___ avec nous.", ok: "viennes", no: ["viens", "viendras"] },
  { g: 3, q: "Il pleut, ___ il fait chaud.", ok: "pourtant", no: ["donc", "parce que"] },
];

const PLACE_ES = [
  { g: 0, q: "Sírveme un ___ de agua.", ok: "vaso", no: ["baso", "bazo"] },
  { g: 0, q: "___ es lunes.", ok: "Hoy", no: ["Oy", "Hoi"] },
  { g: 0, q: "Había mucha ___ en el concierto.", ok: "gente", no: ["jente"] },
  { g: 0, q: "Me duele el ___ nuevo.", ok: "zapato", no: ["sapato", "zapatto"] },
  { g: 1, q: "Mañana tengo ___ de inglés.", ok: "examen", no: ["exámen"] },
  { g: 1, q: "¿___ vienes a la fiesta?", ok: "Tú", no: ["Tu"] },
  { g: 1, q: "¿___ llegaste tarde?", ok: "Por qué", no: ["Porque", "Porqué"] },
  { g: 1, q: "Ya he ___ la tarea.", ok: "hecho", no: ["echo"] },
  { g: 2, q: "Mi ___ es hermoso.", ok: "país", no: ["pais"] },
  { g: 2, q: "Pregúntale ___ vive.", ok: "dónde", no: ["donde"] },
  { g: 2, q: "Escribí el ___ del video.", ok: "guion", no: ["guión"] },
  { g: 2, q: "La lluvia ___ toda la noche.", ok: "cayó", no: ["calló"] },
];
