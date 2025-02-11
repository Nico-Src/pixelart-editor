import Aura from '@primevue/themes/aura';

export default defineNuxtConfig({
    ssr: false,
    devtools: { enabled: false },
    experimental: {
        viewTransition: true,
    },
    app: {
        pageTransition: { name: 'page', mode: 'out-in' },
        baseURL: '/portfolio/projects/pixelart-editor'
    },
    css: [
        '@/assets/css/variables.css',
        '@/assets/css/global.css',
    ],
    modules: [['@nuxtjs/google-fonts', {
        families: {
            Poppins: {
                wght: [100,200,300,400,500,600,700,800,900]
            },
            'Space Grotesk': {
                wght: [100,200,300,400,500,600,700,800,900]
            },
            Quicksand: {
                wght: [100,200,300,400,500,600,700,800,900]
            },
            Roboto: {
                wght: [100,200,300,400,500,600,700,800,900]
            }
        }
    }], 'nuxt-icon', '@nuxt/image', 'nuxt-snackbar', '@nuxtjs/robots', '@primevue/nuxt-module','@formkit/auto-animate/nuxt'],
    plugins: [
        { src: '~/plugins/global.js', mode: 'client' }
    ],
    snackbar: {
        bottom: true,
        right: true,
        duration: 5000,
        dense: true,
        border: "left",
        backgroundOpacity: 0.28
    },
    primevue: {
        options: {
            theme: {
                preset: Aura
            }
        },
        ripple: true
    }
});