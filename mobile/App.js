import React,{useState} from 'react';
import {SafeAreaView,View,Text,TouchableOpacity,StyleSheet,Linking,ActivityIndicator} from 'react-native';
import {StatusBar} from 'expo-status-bar';
import {WebView} from 'react-native-webview';
const WEBSITE='https://spartacusprotein.com';
export default function App(){
 const [tab,setTab]=useState('articles'),[loading,setLoading]=useState(true);
 const urls={articles:WEBSITE+'/wp-json/wp/v2/posts',products:WEBSITE+'/shop/',offers:WEBSITE+'/shop/?on_sale=1'};
 const [lang,setLang]=useState('ar');
 const destination=tab==='articles'?WEBSITE+(lang==='ar'?'/ar/':'/blog/'):urls[tab];
 return <SafeAreaView style={styles.root}><StatusBar style="light"/><View style={styles.header}><Text style={styles.brand}>SPARTACUS COMMUNITY</Text><TouchableOpacity onPress={()=>setLang(lang==='ar'?'en':'ar')}><Text style={styles.lang}>{lang==='ar'?'English':'العربية'}</Text></TouchableOpacity></View><View style={styles.tabs}>{[['articles','المقالات'],['products','المنتجات'],['offers','العروض']].map(([key,label])=><TouchableOpacity key={key} onPress={()=>{setTab(key);setLoading(true)}} style={[styles.tab,tab===key&&styles.active]}><Text style={styles.tabText}>{label}</Text></TouchableOpacity>)}</View><WebView key={destination} source={{uri:destination}} style={styles.web} startInLoadingState onLoadStart={()=>setLoading(true)} onLoadEnd={()=>setLoading(false)} onShouldStartLoadWithRequest={r=>{if(r.url.startsWith('https://spartacusprotein.com/')||r.url==='https://spartacusprotein.com')return true;Linking.openURL(r.url).catch(()=>{});return false}}/>{loading&&<ActivityIndicator style={styles.spinner} size="large" color="#df0000"/>}</SafeAreaView>;
}
const styles=StyleSheet.create({root:{flex:1,backgroundColor:'#191919'},header:{padding:18,backgroundColor:'#191919',flexDirection:'row',justifyContent:'space-between'},brand:{color:'white',fontSize:17,fontWeight:'bold'},lang:{color:'white'},tabs:{flexDirection:'row',backgroundColor:'#333'},tab:{flex:1,padding:13,alignItems:'center'},active:{backgroundColor:'#b90000'},tabText:{color:'white',fontWeight:'bold'},web:{flex:1},spinner:{position:'absolute',top:'50%',alignSelf:'center'}});
