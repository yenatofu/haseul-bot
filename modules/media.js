//Require modules

const Discord = require("discord.js");
const axios = require("axios")
const functions = require("../functions/functions");

//Functions

exports.msg = async function (message, args) {

    //Handle commands

    if (args.length < 1) return;
    switch (args[0].toLowerCase()) {    

        case ".youtube":
        case ".yt":
            message.channel.startTyping();
            yt_pages(message, args.slice(1).join(' ')).then(response => {
                if (response) message.channel.send(response);
                message.channel.stopTyping();
            }).catch(error => {
                console.error(error);
                message.channel.stopTyping();
            })
            break;
        
        case ".letterboxd":
        case ".lb":
            message.channel.startTyping();
            lb_movie_query(args.slice(1).join(' ')).then(response => {
                if (response) message.channel.send(response);
                message.channel.stopTyping();
            }).catch(error => {
                console.error(error);
                message.channel.stopTyping();
            })
            break;

    }
}

yt_vid_query = async function (query) {

    if (!query) {
        resolve("\\⚠ Please provide a query to search for!");
        return;
    }
    let response = await axios.get(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`);
    let search = response.data.match(/<div class="yt-lockup-content"><h3 class="yt-lockup-title "><a href="\/watch\?v=([^&"]+)/i);
    if (!search) {
        return "\\⚠ No results found for this search!";
    }
    let video_id = search[1];
    return video_id;

}

yt_pages = async function (message, query) {

    if (!query) {
        return "\\⚠ Please provide a query to search for!";
    }
    let { data } = await axios.get(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`);
    let regExp = /<div class="yt-lockup-content"><h3 class="yt-lockup-title "><a href="\/watch\?v=([^&"]+)/ig;
    let pages = [];

    let search = regExp.exec(data);
    while (search) {
        pages.push(`https://youtu.be/${search[1]}`);
        search = regExp.exec(data);
    }
    if (pages.length < 1) {
        return "\\⚠ No results found for this query!";
    }
    functions.pages(message.channel, message.author, pages, 600000, true);
    
}

lb_movie_query = async function (query) {
    
    if (!query) {
        return "\\⚠ Please provide a query to search for!";
    }
    let user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.140 Safari/537.36";
    const letterboxd = axios.create({
        baseURL: 'https://letterboxd.com',
        timeout: 5000,
        headers: { "User-Agent": user_agent }
    })
    let { data } = await letterboxd.get(`/search/films/${encodeURIComponent(query)}`);
    let regExp = /<ul class="results">[^]*?data-film-link="(.*?)"/i;
    let result = data.match(regExp);
    return result ? "https://letterboxd.com" + result[1] : "\\⚠ No results found.";

}

exports.yt_vid_query = yt_vid_query;