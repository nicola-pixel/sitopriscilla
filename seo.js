(function (global) {
  'use strict';

  var config = global.PriscillaConfig || {};
  var SITE_NAME = 'Priscilla Castellani Tarabini';
  var DEFAULT_TITLE =
    'Priscilla Castellani Tarabini | Nutrizionista Sportiva – Piano alimentare e materiale nutrizionale';
  var DEFAULT_DESCRIPTION =
    'Biologa Nutrizionista specializzata in nutrizione sportiva e clinica. Piani alimentari personalizzati, consulenze in studio (Milano, Modena, Trezzo sull\'Adda) e online. Prenota la prima visita su Calendly.';
  var DEFAULT_IMAGE = '/assets/priscilla-portrait.png';

  function getSiteUrl() {
    var url = (config.siteUrl || '').replace(/\/$/, '');
    if (url) return url;
    return global.location && global.location.origin ? global.location.origin : '';
  }

  function absoluteUrl(path) {
    if (!path) return getSiteUrl() + '/';
    if (/^https?:\/\//i.test(path)) return path;
    var base = getSiteUrl();
    if (!base) return path;
    return base + (path.charAt(0) === '/' ? path : '/' + path.replace(/^\.\//, ''));
  }

  function setMeta(attr, key, content) {
    if (!content && content !== 0) return;
    var el = document.querySelector('meta[' + attr + '="' + key + '"]');
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute('content', String(content));
  }

  function setLink(rel, href) {
    if (!href) return;
    var el = document.querySelector('link[rel="' + rel + '"]');
    if (!el) {
      el = document.createElement('link');
      el.setAttribute('rel', rel);
      document.head.appendChild(el);
    }
    el.setAttribute('href', href);
  }

  function injectJsonLd(id, data) {
    var existing = document.getElementById(id);
    if (existing) existing.remove();
    var script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = id;
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
  }

  function applyPageMeta(options) {
    options = options || {};
    var title = options.title || DEFAULT_TITLE;
    var description = options.description || DEFAULT_DESCRIPTION;
    var image = options.image || DEFAULT_IMAGE;
    var type = options.type || 'website';
    var path = options.path;
    var url = path
      ? absoluteUrl(path)
      : global.location
        ? global.location.href.split('#')[0].split('?')[0]
        : '';
    var robots = options.robots || 'index, follow, max-image-preview:large';

    document.title = title;
    setMeta('name', 'description', description);
    setMeta('name', 'robots', robots);
    if (url) setLink('canonical', url);

    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:locale', 'it_IT');
    setMeta('property', 'og:site_name', SITE_NAME);
    if (url) setMeta('property', 'og:url', url);
    setMeta('property', 'og:image', absoluteUrl(image));

    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', absoluteUrl(image));
  }

  function setPageSeo(options) {
    applyPageMeta({
      title: options.title,
      description: options.description,
      image: options.image,
      type: options.type,
      path: options.url,
      robots: options.robots,
    });
  }

  function injectHomeSchema() {
    var siteUrl = getSiteUrl();
    var personId = siteUrl + '/#person';
    var businessId = siteUrl + '/#business';
    var websiteId = siteUrl + '/#website';

    injectJsonLd('schema-org-graph', {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          '@id': websiteId,
          url: siteUrl + '/',
          name: SITE_NAME + ' — Nutrizionista sportiva',
          description: DEFAULT_DESCRIPTION,
          inLanguage: 'it-IT',
          publisher: { '@id': personId },
        },
        {
          '@type': ['Person', 'Dietitian'],
          '@id': personId,
          name: 'Priscilla Castellani Tarabini',
          honorificPrefix: 'Dott.ssa',
          jobTitle: 'Biologa Nutrizionista — Nutrizionista sportiva',
          description:
            'Nutrizionista sportiva e clinica. Laurea in Dietistica e Magistrale in Alimentazione e Nutrizione Umana (Università di Milano). Certificazioni ISAK Level 2, SANIS, FIGC.',
          image: absoluteUrl(DEFAULT_IMAGE),
          url: siteUrl + '/',
          email: 'priscilla.castellanitarabini@gmail.com',
          telephone: '+393278205996',
          knowsAbout: [
            'Nutrizione sportiva',
            'Nutrizione clinica',
            'Piani alimentari personalizzati',
            'Composizione corporea',
            'Alimentazione vegetariana e vegana',
            'Patologie cardiometaboliche',
          ],
          alumniOf: {
            '@type': 'CollegeOrUniversity',
            name: 'Università degli Studi di Milano',
          },
          worksFor: { '@id': businessId },
        },
        {
          '@type': 'Dietitian',
          '@id': businessId,
          name: SITE_NAME + ' — Consulenza nutrizionale',
          url: siteUrl + '/',
          telephone: '+393278205996',
          email: 'priscilla.castellanitarabini@gmail.com',
          image: absoluteUrl(DEFAULT_IMAGE),
          medicalSpecialty: 'Nutrizione sportiva e clinica',
          areaServed: ['Milano', 'Modena', "Trezzo sull'Adda"],
          location: [
            {
              '@type': 'Place',
              name: 'Studio Milano',
              address: {
                '@type': 'PostalAddress',
                streetAddress: 'Via dei Fabbri 12',
                addressLocality: 'Milano',
                postalCode: '20123',
                addressRegion: 'MI',
                addressCountry: 'IT',
              },
            },
            {
              '@type': 'Place',
              name: 'Studio Modena',
              address: {
                '@type': 'PostalAddress',
                streetAddress: 'Via Tamburini 99',
                addressLocality: 'Modena',
                postalCode: '41124',
                addressRegion: 'MO',
                addressCountry: 'IT',
              },
            },
            {
              '@type': 'Place',
              name: "Studio Trezzo sull'Adda",
              address: {
                '@type': 'PostalAddress',
                streetAddress: 'Via Gianfranco Miglio 5',
                addressLocality: "Trezzo sull'Adda",
                postalCode: '20056',
                addressRegion: 'MI',
                addressCountry: 'IT',
              },
            },
          ],
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: '5',
            bestRating: '5',
            ratingCount: '23',
          },
          potentialAction: {
            '@type': 'ReserveAction',
            name: 'Prenota la prima visita nutrizionale',
            target: siteUrl + '/#prenota',
          },
        },
        {
          '@type': 'FAQPage',
          '@id': siteUrl + '/#faq',
          mainEntity: [
            {
              '@type': 'Question',
              name: 'Chi è Priscilla Castellani Tarabini?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Biologa Nutrizionista specializzata in nutrizione sportiva e clinica, con laurea in Dietistica e Magistrale in Alimentazione e Nutrizione Umana (Università di Milano). Propone piani alimentari personalizzati con un approccio flessibile e moderato.',
              },
            },
            {
              '@type': 'Question',
              name: 'Dove si trovano gli studi e come prenotare?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Riceve a Milano (Via dei Fabbri 12), Modena (Via Tamburini 99) e Trezzo sull\'Adda (Via Gianfranco Miglio 5), oppure online in videochiamata. Per la prima visita usa la sezione Prenota con prenotazione tramite Calendly.',
              },
            },
            {
              '@type': 'Question',
              name: 'Quali servizi nutrizionali offre?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Il percorso comprende consulenza iniziale, piano alimentare su misura con materiale nutrizionale e follow-up. Sono disponibili visite in studio, online, consulenze mirate e valutazione della composizione corporea.',
              },
            },
            {
              '@type': 'Question',
              name: 'Quali aree di competenza tratta?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Nutrizione sportiva, dimagrimento e ricomposizione corporea, educazione alimentare, alimentazione vegetariana e vegana, allergie e intolleranze, dietoterapia per patologie cardiometaboliche e gestione nutrizionale di patologie del microcircolo.',
              },
            },
            {
              '@type': 'Question',
              name: 'Come contattare la dottoressa?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Telefono +39 327 8205 996, email priscilla.castellanitarabini@gmail.com. Puoi prenotare online dalla sezione Prenota del sito.',
              },
            },
          ],
        },
      ],
    });
  }

  function injectBreadcrumbSchema(items) {
    injectJsonLd('schema-org-breadcrumb', {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map(function (item, index) {
        return {
          '@type': 'ListItem',
          position: index + 1,
          name: item.name,
          item: absoluteUrl(item.path),
        };
      }),
    });
  }

  function injectArticleSchema(opts) {
    injectJsonLd('schema-org-article', {
      '@context': 'https://schema.org',
      '@type': opts.schemaType || 'BlogPosting',
      headline: opts.title,
      description: opts.description,
      url: absoluteUrl(opts.path),
      inLanguage: 'it-IT',
      author: {
        '@type': 'Person',
        name: SITE_NAME,
        jobTitle: 'Biologa Nutrizionista',
      },
      mainEntityOfPage: absoluteUrl(opts.path),
    });
    injectBreadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: opts.breadcrumbLabel || 'Articolo', path: opts.path },
    ]);
  }

  function injectRecipeSchema(opts) {
    injectJsonLd('schema-org-recipe', {
      '@context': 'https://schema.org',
      '@type': 'Recipe',
      name: opts.title,
      description: opts.description,
      url: absoluteUrl(opts.path),
      inLanguage: 'it-IT',
      author: { '@type': 'Person', name: SITE_NAME },
      recipeCategory: opts.category || 'Ricetta salutare',
    });
    injectBreadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: opts.title || 'Ricetta', path: opts.path },
    ]);
  }

  global.PriscillaSeo = {
    SITE_NAME: SITE_NAME,
    DEFAULT_TITLE: DEFAULT_TITLE,
    DEFAULT_DESCRIPTION: DEFAULT_DESCRIPTION,
    DEFAULT_IMAGE: DEFAULT_IMAGE,
    getSiteUrl: getSiteUrl,
    absoluteUrl: absoluteUrl,
    setMeta: setMeta,
    setLink: setLink,
    setPageSeo: setPageSeo,
    applyPageMeta: applyPageMeta,
    injectHomeSchema: injectHomeSchema,
    injectArticleSchema: injectArticleSchema,
    injectRecipeSchema: injectRecipeSchema,
    injectBreadcrumbSchema: injectBreadcrumbSchema,
  };

  var page = document.documentElement.getAttribute('data-seo-page');
  if (page === 'home') {
    applyPageMeta({ path: '/' });
    injectHomeSchema();
  } else if (page === 'scarica') {
    applyPageMeta({
      title: 'Scarica materiale | ' + SITE_NAME,
      description:
        'Area download riservata ai pazienti per materiali informativi — ' + SITE_NAME + '.',
      path: '/scarica.html',
      robots: 'noindex, nofollow',
    });
  } else if (page === 'blog') {
    applyPageMeta({
      title: 'Articoli e approfondimenti | ' + SITE_NAME,
      description:
        'Articoli su nutrizione sportiva, alimentazione sana e benessere — ' + SITE_NAME + '.',
      path: '/blog.html',
      type: 'website',
    });
  } else if (page === 'ricetta') {
    applyPageMeta({
      title: 'Ricette salutari | ' + SITE_NAME,
      description:
        'Ricette salutari per atleti e sportivi — ' + SITE_NAME + ', Biologa Nutrizionista.',
      path: '/ricetta.html',
      type: 'website',
    });
  }
})(window);
