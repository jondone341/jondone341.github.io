// File Path: netlify/functions/get-news.js

const fetch = require('node-fetch');

// API Keys ko surakshit tarike se access karna
const GNEWS_API_KEY = process.env.GNEWS_API_KEY;
const NEWSAPI_API_KEY = process.env.NEWSAPI_API_KEY;
const MEDIASTACK_API_KEY = process.env.MEDIASTACK_API_KEY;

// Teeno APIs se data laane ke functions

async function fetchGNews(category, lang, query) {
    let url;
    if (query) {
        url = `https://gnews.io/api/v4/search?q=${query}&lang=${lang}&token=${GNEWS_API_KEY}`;
    } else {
        const gnewsCategory = category === 'nation' ? 'general' : category; // GNews me nation nahi hota
        url = `https://gnews.io/api/v4/top-headlines?topic=${gnewsCategory}&lang=${lang}&token=${GNEWS_API_KEY}`;
    }
    const response = await fetch(url);
    const data = await response.json();
    if (!data.articles) return [];
    // Data ko ek standard format me badalna
    return data.articles.map(article => ({
        title: article.title,
        description: article.description,
        url: article.url,
        image: article.image,
        publishedAt: article.publishedAt,
        source: { name: article.source.name }
    }));
}

async function fetchNewsAPI(category, lang, query) {
    // NewsAPI me sirf 'en' language support hai free plan me
    if (lang !== 'en') return []; 
    let url;
    if (query) {
        url = `https://newsapi.org/v2/everything?q=${query}&apiKey=${NEWSAPI_API_KEY}`;
    } else {
        url = `https://newsapi.org/v2/top-headlines?country=us&category=${category}&apiKey=${NEWSAPI_API_KEY}`;
    }
    const response = await fetch(url);
    const data = await response.json();
    if (!data.articles) return [];
    return data.articles.map(article => ({
        title: article.title,
        description: article.description,
        url: article.url,
        image: article.urlToImage,
        publishedAt: article.publishedAt,
        source: { name: article.source.name }
    }));
}

async function fetchMediaStack(category, lang, query) {
    // MediaStack language support format: 'en', 'hi', etc.
    const mediaStackLang = lang === 'hi' ? 'hi,en' : 'en'; // Hindi ke saath English bhi fetch karein
    let url;
    if (query) {
        url = `http://api.mediastack.com/v1/news?access_key=${MEDIASTACK_API_KEY}&keywords=${query}&languages=${mediaStackLang}&sort=popularity`;
    } else {
        url = `http://api.mediastack.com/v1/news?access_key=${MEDIASTACK_API_KEY}&categories=${category}&languages=${mediaStackLang}&sort=popularity`;
    }
    const response = await fetch(url);
    const data = await response.json();
    if (!data.data) return [];
    return data.data.map(article => ({
        title: article.title,
        description: article.description,
        url: article.url,
        image: article.image,
        publishedAt: article.published_at,
        source: { name: article.source }
    }));
}

// Main function jo Netlify call karega
exports.handler = async function (event, context) {
    try {
        const { category, lang, q } = event.queryStringParameters;

        // Teeno APIs ko ek saath call karna (Parallel fetching)
        const promises = [
            fetchGNews(category, lang, q),
            fetchNewsAPI(category, lang, q),
            fetchMediaStack(category, lang, q)
        ];

        const results = await Promise.allSettled(promises);
        
        let combinedArticles = [];
        results.forEach(result => {
            if (result.status === 'fulfilled' && Array.isArray(result.value)) {
                combinedArticles = combinedArticles.concat(result.value);
            }
        });
        
        // Duplicate articles ko hatana (title ke aadhar par)
        const uniqueArticles = Array.from(new Set(combinedArticles.map(a => a.title)))
            .map(title => {
                return combinedArticles.find(a => a.title === title)
            });

        // Articles ko naye se purane ke kram me sort karna
        uniqueArticles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

        return {
            statusCode: 200,
            body: JSON.stringify({ articles: uniqueArticles }),
        };

    } catch (error) {
        console.error("Error in serverless function:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Server me kuch gadbad ho gayi.' }),
        };
    }
};
