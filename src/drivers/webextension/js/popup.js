/* eslint-env browser */
/* global browser, chrome, jsonToDOM */

/** global: chrome */
/** global: browser */
/** global: jsonToDOM */

let pinnedCategory = null;
let termsAccepted = false;

function slugify(string) {
  return string.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/--+/g, '-').replace(/(?:^-|-$)/, '');
}

function i18n() {
  const nodes = document.querySelectorAll('[data-i18n]');

  Array.prototype.forEach.call(nodes, (node) => {
    node.innerHTML = browser.i18n.getMessage(node.dataset.i18n);
  });
}

function replaceDom(domTemplate) {
  const container = document.getElementsByClassName('container')[0];

  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  container.appendChild(jsonToDOM(domTemplate, document, {}));

  i18n();

  Array.from(document.querySelectorAll('.detected__category-pin-wrapper')).forEach((pin) => {
    pin.addEventListener('click', () => {
      const categoryId = parseInt(pin.dataset.categoryId, 10);

      if (categoryId === pinnedCategory) {
        pin.className = 'detected__category-pin-wrapper';

        pinnedCategory = null;
      } else {
        const active = document.querySelector('.detected__category-pin-wrapper--active');

        if (active) {
          active.className = 'detected__category-pin-wrapper';
        }

        pin.className = 'detected__category-pin-wrapper detected__category-pin-wrapper--active';

        pinnedCategory = categoryId;
      }

      (chrome || browser).runtime.sendMessage({
        id: 'set_option',
        key: 'pinnedCategory',
        value: pinnedCategory,
      });
    });
  });
}

function replaceDomWhenReady(dom) {
  if (/complete|interactive|loaded/.test(document.readyState)) {
    replaceDom(dom);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      replaceDom(dom);
    });
  }
}

function appsToDomTemplate(response) {
  let template = [];

  if (response.tabCache && Object.keys(response.tabCache.detected).length > 0) {
    const categories = {};

    // Group apps by category
    for (const appName in response.tabCache.detected) {
      response.apps[appName].cats.forEach((cat) => {
        categories[cat] = categories[cat] || { apps: [] };

        categories[cat].apps[appName] = appName;
      });
    }

    for (const cat in categories) {
      const apps = [];

      for (const appName in categories[cat].apps) {
        const { confidence, version } = response.tabCache.detected[appName];

        apps.push(
          [
            'a', {
              class: 'detected__app',
              target: '_blank',
              href: `https://www.wappalyzer.com/technologies/${slugify(appName)}`,
            }, [
              'img', {
                class: 'detected__app-icon',
                src: `../images/icons/${response.apps[appName].icon || 'default.svg'}`,
              },
            ], [
              'span', {
                class: 'detected__app-name',
              },
              appName,
            ], version ? [
              'span', {
                class: 'detected__app-version',
              },
              version,
            ] : null, confidence < 100 ? [
              'span', {
                class: 'detected__app-confidence',
              },
              `${confidence}% sure`,
            ] : null,
          ],
        );
      }

      template.push(
        [
          'div', {
            class: 'detected__category',
          }, [
            'div', {
              class: 'detected__category-name',
            }, [
              'a', {
                class: 'detected__category-link',
                target: '_blank',
                href: `https://www.wappalyzer.com/categories/${slugify(response.categories[cat].name)}`,
              },
              browser.i18n.getMessage(`categoryName${cat}`),
            ], [
              'span', {
                class: `detected__category-pin-wrapper${pinnedCategory == cat ? ' detected__category-pin-wrapper--active' : ''}`,
                'data-category-id': cat,
                title: browser.i18n.getMessage('categoryPin'),
              }, [
                'img', {
                  class: 'detected__category-pin detected__category-pin--active',
                  src: '../images/pin-active.svg',
                },
              ], [
                'img', {
                  class: 'detected__category-pin detected__category-pin--inactive',
                  src: '../images/pin.svg',
                },
              ],
            ],
          ], [
            'div', {
              class: 'detected__apps',
            },
            apps,
          ],
        ],
      );
    }

    template = [
      'div', {
        class: 'detected',
      },
      template,
    ];
  } else {
    template = [
      'div', {
        class: 'empty',
      },
      [
        'span', {
          class: 'empty__text',
        },
        browser.i18n.getMessage('noAppsDetected'),
      ],
    ];
  }

  return template;
}

const func = (tabs) => {
  (chrome || browser).runtime.sendMessage({
    id: 'get_apps',
    tab: tabs[0],
    source: 'popup.js',
  }, (response) => {
    pinnedCategory = response.pinnedCategory;
    termsAccepted = response.termsAccepted;

    if (termsAccepted) {
      replaceDomWhenReady(appsToDomTemplate(response));
    } else {
      i18n();

      const wrapper = document.querySelector('.terms__wrapper');

      document.querySelector('.terms__accept').addEventListener('click', () => {
        (chrome || browser).runtime.sendMessage({
          id: 'set_option',
          key: 'termsAccepted',
          value: true,
        });

        wrapper.classList.remove('terms__wrapper--active');

        func(tabs);
      });

      wrapper.classList.add('terms__wrapper--active');
    }
  });
};

browser.tabs.query({ active: true, currentWindow: true })
  .then(func)
  .catch(console.error);
