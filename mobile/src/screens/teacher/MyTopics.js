import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    TextInput,
    Image,
    Alert,
    LayoutAnimation,
    Platform,
    UIManager
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../api/firebase';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { collection, query, where, getDocs, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, orderBy, limit, startAt, endAt, getDoc } from 'firebase/firestore';
import {
    ArrowLeft,
    Calendar,
    BookOpen,
    Clock,
    Users,
    CheckCircle,
    XCircle,
    ChevronDown,
    ChevronUp,
    ChevronLeft,
    ChevronRight,
    FileText,
    Plus,
    Trash2,
    Image as ImageIcon,
    X,
    Layers,
    Download
} from 'lucide-react-native';

const MyTopics = ({ navigation }) => {
    const { userData } = useAuth();
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [records, setRecords] = useState([]);
    const [classes, setClasses] = useState({});
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [expandedId, setExpandedId] = useState(null);
    const [materials, setMaterials] = useState({});
    const [activeTab, setActiveTab] = useState('note'); // 'note' or 'assignment'
    const [noteText, setNoteText] = useState('');
    const [assignmentText, setAssignmentText] = useState('');
    const [selectedImage, setSelectedImage] = useState(null);
    const [selectedPDF, setSelectedPDF] = useState(null); // { uri, name, base64 }
    const [submitting, setSubmitting] = useState(false);
    const [generatingReport, setGeneratingReport] = useState(false);

    const fetchData = async () => {
        if (!userData?.college_id || !userData?.uid) return;

        setLoading(true);
        try {
            // 1. Fetch Classes to resolve names
            const classesQuery = query(
                collection(db, 'colleges', userData.college_id, 'classes')
            );
            const classesSnapshot = await getDocs(classesQuery);
            const classMap = {};
            classesSnapshot.docs.forEach(doc => {
                const data = doc.data();
                classMap[doc.id] = `${data.branch} - ${data.section}`;
            });
            setClasses(classMap);

            // 2. Fetch Attendance Records (Lessons delivered by this teacher)
            const q = query(
                collection(db, 'attendance_records'),
                where('college_id', '==', userData.college_id),
                where('marked_by', '==', userData.uid),
                where('date', '==', date)
            );

            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Client-side sorting by period
            const sortedData = data.sort((a, b) => a.period - b.period);
            setRecords(sortedData);
        } catch (error) {
            console.error("Error fetching my topics:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [date, userData]);

    // real-time listener for materials
    useEffect(() => {
        if (!userData?.college_id) return;

        const q = query(
            collection(db, 'topic_materials'),
            where('college_id', '==', userData.college_id),
            where('created_by', '==', userData.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const mats = {};
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (!mats[data.attendance_record_id]) mats[data.attendance_record_id] = [];
                mats[data.attendance_record_id].push({ id: doc.id, ...data });
            });
            setMaterials(mats);
        });

        return () => unsubscribe();
    }, [userData]);

    const toggleExpand = (id) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedId(expandedId === id ? null : id);
    };

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert("Permission Denied", "We need access to your gallery to upload images.");
            return;
        }

        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.5,
            base64: true,
        });

        if (!result.canceled) {
            const asset = result.assets[0];
            if (asset.fileSize && asset.fileSize > 800000) {
                Alert.alert("Image too large", "Please select an image under 800KB.");
                return;
            }
            setSelectedImage(`data:image/jpeg;base64,${asset.base64}`);
        }
    };

    const pickPDF = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/pdf',
                copyToCacheDirectory: true
            });

            if (!result.canceled) {
                const asset = result.assets[0];
                
                // Firestore limit is 1MB total, so 750KB for PDF is safe
                if (asset.size && asset.size > 750000) {
                    Alert.alert("File too large", "Please select a PDF under 750KB.");
                    return;
                }

                const base64 = await FileSystem.readAsStringAsync(asset.uri, {
                    encoding: FileSystem.EncodingType.Base64
                });

                setSelectedPDF({
                    uri: asset.uri,
                    name: asset.name,
                    base64: `data:application/pdf;base64,${base64}`
                });
            }
        } catch (error) {
            console.error("PDF Picker Error:", error);
            Alert.alert("Error", "Failed to select PDF.");
        }
    };

    const handleViewPDF = async (mat) => {
        if (!mat.pdf_url) return;
        try {
            const tempFile = `${FileSystem.cacheDirectory}${mat.pdf_name || 'document.pdf'}`;
            await FileSystem.writeAsStringAsync(tempFile, mat.pdf_url.split(',')[1], {
                encoding: FileSystem.EncodingType.Base64
            });
            await Sharing.shareAsync(tempFile);
        } catch (error) {
            console.error("Error opening PDF:", error);
            Alert.alert("Error", "Could not open PDF.");
        }
    };

    const handleAddMaterial = async (record) => {
        const text = activeTab === 'note' ? noteText : assignmentText;
        if (!text.trim() && !selectedImage) return;

        setSubmitting(true);
        try {
            await addDoc(collection(db, 'topic_materials'), {
                attendance_record_id: record.id,
                college_id: userData.college_id,
                class_id: record.class_id,
                type: activeTab,
                text: text.trim(),
                image_url: selectedImage,
                pdf_url: selectedPDF?.base64 || null,
                pdf_name: selectedPDF?.name || null,
                created_by: userData.uid,
                created_by_name: userData.name,
                date: record.date,
                period: record.period,
                subject_name: record.subject_name || 'General Class',
                created_at: serverTimestamp()
            });

            if (activeTab === 'note') setNoteText('');
            else setAssignmentText('');
            setSelectedImage(null);
            setSelectedPDF(null);
        } catch (error) {
            console.error("Error adding material:", error);
            Alert.alert("Error", "Failed to save material.");
        } finally {
            setSubmitting(false);
        }
    };

    const generateMonthlyReport = async () => {
        if (!userData?.college_id || !userData?.uid) return;

        setGeneratingReport(true);
        try {
            const currentYear = new Date(date).getFullYear();
            const currentMonth = new Date(date).getMonth();
            const monthName = new Date(date).toLocaleString('default', { month: 'long' });
            
            // 1. Calculate boundaries for the selected month
            const firstDay = new Date(currentYear, currentMonth, 1);
            const lastDay = new Date(currentYear, currentMonth + 1, 0);
            
            const startDate = firstDay.toISOString().split('T')[0];
            const endDate = lastDay.toISOString().split('T')[0];

            // 2. Fetch monthly records
            const q = query(
                collection(db, 'attendance_records'),
                where('college_id', '==', userData.college_id),
                where('marked_by', '==', userData.uid),
                where('date', '>=', startDate),
                where('date', '<=', endDate)
            );

            const snapshot = await getDocs(q);
            if (snapshot.empty) {
                Alert.alert("No Data", `No topics found for ${monthName} ${currentYear}.`);
                return;
            }

            const monthlyRecords = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => {
                    if (a.date !== b.date) return a.date.localeCompare(b.date);
                    return (a.period || 0) - (b.period || 0);
                });

            // 3. Build HTML
            const htmlContent = `
                <html>
                    <head>
                        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
                        <style>
                            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
                            .header { margin-bottom: 30px; border-bottom: 2px solid #7c3aed; padding-bottom: 20px; }
                            .title { color: #7c3aed; font-size: 24pt; margin: 0; font-weight: bold; }
                            .meta-container { display: flex; justify-content: space-between; margin-top: 15px; flex-wrap: wrap; }
                            .meta-item { color: #64748b; font-size: 11pt; margin-bottom: 5px; min-width: 200px; }
                            .meta-label { font-weight: bold; color: #475569; }
                            table { width: 100%; border-collapse: collapse; margin-top: 25px; table-layout: fixed; }
                            th { background-color: #f8fafc; text-align: left; padding: 12px; font-size: 10pt; color: #64748b; border-bottom: 2px solid #e2e8f0; text-transform: uppercase; letter-spacing: 0.05em; }
                            td { padding: 12px; font-size: 10pt; border-bottom: 1px solid #f1f5f9; color: #334155; vertical-align: top; word-wrap: break-word; }
                            .date-col { width: 20%; font-weight: bold; color: #7c3aed; }
                            .period-col { width: 15%; }
                            .subject-col { width: 25%; font-weight: 500; }
                            .topic-col { width: 40%; }
                            .footer { margin-top: 50px; font-size: 9pt; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 20px; }
                        </style>
                    </head>
                    <body>
                        <div class="header">
                            <h1 class="title">Monthly Topics Report</h1>
                            <div class="meta-container">
                                <div class="meta-item"><span class="meta-label">Teacher:</span> ${userData.name}</div>
                                <div class="meta-item"><span class="meta-label">Month:</span> ${monthName} ${currentYear}</div>
                                <div class="meta-item"><span class="meta-label">Generated:</span> ${new Date().toLocaleDateString()}</div>
                            </div>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th style="width: 20%">Date</th>
                                    <th style="width: 15%">Period</th>
                                    <th style="width: 25%">Subject</th>
                                    <th style="width: 40%">Topic</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${monthlyRecords.map(rec => `
                                    <tr>
                                        <td class="date-col">${rec.date}</td>
                                        <td class="period-col">Period ${rec.period}</td>
                                        <td class="subject-col">${rec.subject_name || '-'}</td>
                                        <td class="topic-col">${rec.topic || 'No topic recorded.'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        <div class="footer">
                            <p>This is an automated report generated by the CampZen Education Platform.</p>
                        </div>
                    </body>
                </html>
            `;

            // 4. Generate and Share
            const { uri } = await Print.printToFileAsync({ html: htmlContent });
            await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });

        } catch (error) {
            console.error("PDF generation failed:", error);
            Alert.alert("Error", "Failed to generate report PDF. " + error.message);
        } finally {
            setGeneratingReport(false);
        }
    };

    const handleDeleteMaterial = async (id) => {
        Alert.alert(
            "Delete Item",
            "Are you sure you want to delete this material?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deleteDoc(doc(db, 'topic_materials', id));
                        } catch (error) {
                            console.error("Error deleting material:", error);
                        }
                    }
                }
            ]
        );
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const changeDate = (days) => {
        const d = new Date(date);
        d.setDate(d.getDate() + days);
        setDate(d.toISOString().split('T')[0]);
    };

    const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#1e293b" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>My Topics</Text>
                    <Text style={styles.subtitle}>Delivered Lesson Logs</Text>
                </View>
                <TouchableOpacity 
                    style={[styles.downloadBtn, generatingReport && styles.disabledBtn]} 
                    onPress={generateMonthlyReport}
                    disabled={generatingReport}
                >
                    {generatingReport ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <>
                            <Download size={18} color="#fff" />
                            <Text style={styles.downloadBtnText}>Report</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            {/* Date Selector */}
            <View style={styles.dateSelector}>
                <TouchableOpacity onPress={() => changeDate(-1)} style={styles.dateNavBtn}>
                    <ChevronLeft size={20} color="#10b981" />
                </TouchableOpacity>
                <View style={styles.dateDisplay}>
                    <Calendar size={18} color="#10b981" />
                    <Text style={styles.dateText}>{formatDate(date)}</Text>
                </View>
                <TouchableOpacity onPress={() => changeDate(1)} style={styles.dateNavBtn}>
                    <ChevronRight size={20} color="#10b981" />
                </TouchableOpacity>
            </View>

            {loading && !refreshing ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#10b981" />
                    <Text style={styles.loadingText}>Loading your logs...</Text>
                </View>
            ) : (
                <ScrollView
                    style={styles.content}
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                >
                    {records.length === 0 ? (
                        <View style={styles.emptyState}>
                            <View style={styles.emptyIconBox}>
                                <Layers size={48} color="#cbd5e1" />
                            </View>
                            <Text style={styles.emptyTitle}>No Topics Logged</Text>
                            <Text style={styles.emptySubtitle}>
                                You haven't recorded any topics or attendance for this date yet.
                            </Text>
                        </View>
                    ) : (
                        records.map((record, index) => {
                            const isExpanded = expandedId === record.id;
                            const recordMaterials = materials[record.id] || [];
                            const filteredMaterials = recordMaterials.filter(m => m.type === activeTab);

                            return (
                                <View key={record.id} style={styles.topicCard}>
                                    <TouchableOpacity
                                        activeOpacity={0.7}
                                        onPress={() => toggleExpand(record.id)}
                                    >
                                        <View style={styles.cardHeader}>
                                            <View style={styles.periodRow}>
                                                <View style={styles.periodBadge}>
                                                    <Text style={styles.periodText}>P{record.period}</Text>
                                                </View>
                                                <Text style={styles.className}>
                                                    {classes[record.class_id] || record.class_id}
                                                </Text>
                                            </View>
                                            <View style={styles.headerRight}>
                                                <View style={styles.subjectBadge}>
                                                    <BookOpen size={12} color="#10b981" />
                                                </View>
                                                {isExpanded ? (
                                                    <ChevronUp size={20} color="#94a3b8" />
                                                ) : (
                                                    <ChevronDown size={20} color="#94a3b8" />
                                                )}
                                            </View>
                                        </View>

                                        <View style={styles.topicWell}>
                                            <Text style={styles.topicLabel}>TOPIC COVERED</Text>
                                            <Text style={styles.topicText}>
                                                {record.topic || 'No topic details provided.'}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>

                                    {isExpanded && (
                                        <View style={styles.expansionContent}>
                                            <View style={styles.tabsContainer}>
                                                <TouchableOpacity
                                                    style={[styles.tabBtn, activeTab === 'note' && styles.activeTabBtn]}
                                                    onPress={() => setActiveTab('note')}
                                                >
                                                    <FileText size={16} color={activeTab === 'note' ? '#6366f1' : '#64748b'} />
                                                    <Text style={[styles.tabBtnText, activeTab === 'note' && styles.activeTabBtnText]}>Notes</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.tabBtn, activeTab === 'assignment' && styles.activeTabBtn]}
                                                    onPress={() => setActiveTab('assignment')}
                                                >
                                                    <BookOpen size={16} color={activeTab === 'assignment' ? '#6366f1' : '#64748b'} />
                                                    <Text style={[styles.tabBtnText, activeTab === 'assignment' && styles.activeTabBtnText]}>Assignments</Text>
                                                </TouchableOpacity>
                                            </View>

                                            <View style={styles.formContainer}>
                                                <TextInput
                                                    style={styles.materialInput}
                                                    placeholder={`Add ${activeTab === 'note' ? 'notes' : 'assignments'}...`}
                                                    multiline
                                                    value={activeTab === 'note' ? noteText : assignmentText}
                                                    onChangeText={(val) => activeTab === 'note' ? setNoteText(val) : setAssignmentText(val)}
                                                />

                                                {selectedImage && (
                                                    <View style={styles.previewContainer}>
                                                        <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
                                                        <TouchableOpacity style={styles.removeImgBtn} onPress={() => setSelectedImage(null)}>
                                                            <X size={14} color="#fff" />
                                                        </TouchableOpacity>
                                                    </View>
                                                )}

                                                {selectedPDF && (
                                                    <View style={styles.pdfPreview}>
                                                        <FileText size={20} color="#ef4444" />
                                                        <Text style={styles.pdfName} numberOfLines={1}>{selectedPDF.name}</Text>
                                                        <TouchableOpacity onPress={() => setSelectedPDF(null)}>
                                                            <X size={16} color="#94a3b8" />
                                                        </TouchableOpacity>
                                                    </View>
                                                )}

                                                <View style={styles.formActions}>
                                                    <View style={{ flexDirection: 'row', gap: 10 }}>
                                                        <TouchableOpacity style={styles.addImageBtn} onPress={pickImage}>
                                                            <ImageIcon size={18} color="#10b981" />
                                                            <Text style={styles.addImageText}>Image</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity style={[styles.addImageBtn, { backgroundColor: '#fef2f2' }]} onPress={pickPDF}>
                                                            <FileText size={18} color="#ef4444" />
                                                            <Text style={[styles.addImageText, { color: '#ef4444' }]}>PDF</Text>
                                                        </TouchableOpacity>
                                                    </View>

                                                    <TouchableOpacity
                                                        style={[styles.postBtn, (submitting || (!noteText.trim() && !assignmentText.trim() && !selectedImage && !selectedPDF)) && styles.disabledBtn]}
                                                        onPress={() => handleAddMaterial(record)}
                                                        disabled={submitting || (!noteText.trim() && !assignmentText.trim() && !selectedImage && !selectedPDF)}
                                                    >
                                                        {submitting ? (
                                                            <ActivityIndicator size="small" color="#fff" />
                                                        ) : (
                                                            <>
                                                                <Plus size={18} color="#fff" />
                                                                <Text style={styles.postBtnText}>Post</Text>
                                                            </>
                                                        )}
                                                    </TouchableOpacity>
                                                </View>
                                            </View>

                                            <View style={styles.matsList}>
                                                {filteredMaterials.sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0)).map(mat => (
                                                    <View key={mat.id} style={styles.matItem}>
                                                        <View style={styles.matHeader}>
                                                            <Text style={styles.matText}>{mat.text}</Text>
                                                            <TouchableOpacity onPress={() => handleDeleteMaterial(mat.id)}>
                                                                <Trash2 size={16} color="#94a3b8" />
                                                            </TouchableOpacity>
                                                        </View>
                                                        {mat.image_url && (
                                                            <Image source={{ uri: mat.image_url }} style={styles.matImage} resizeMode="contain" />
                                                        )}
                                                        {mat.pdf_url && (
                                                            <TouchableOpacity
                                                                style={styles.pdfItem}
                                                                onPress={() => handleViewPDF(mat)}
                                                            >
                                                                <FileText size={20} color="#ef4444" />
                                                                <Text style={styles.pdfItemText} numberOfLines={1}>{mat.pdf_name || 'View PDF'}</Text>
                                                                <Download size={16} color="#6366f1" />
                                                            </TouchableOpacity>
                                                        )}
                                                    </View>
                                                ))}
                                                {filteredMaterials.length === 0 && (
                                                    <Text style={styles.emptyMatsText}>No {activeTab}s posted yet.</Text>
                                                )}
                                            </View>
                                        </View>
                                    )}

                                    <View style={styles.statsRow}>
                                        <View style={styles.statItem}>
                                            <CheckCircle size={14} color="#10b981" />
                                            <Text style={styles.statValue}>{record.present?.length || 0} Present</Text>
                                        </View>
                                        <View style={styles.statItem}>
                                            <XCircle size={14} color="#ef4444" />
                                            <Text style={styles.statValue}>{record.absent?.length || 0} Absent</Text>
                                        </View>
                                        <View style={styles.statItem}>
                                            <Users size={14} color="#64748b" />
                                            <Text style={styles.statValue}>Total: {(record.present?.length || 0) + (record.absent?.length || 0)}</Text>
                                        </View>
                                    </View>
                                </View>
                            );
                        })
                    )}
                </ScrollView>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
        backgroundColor: '#fff',
        gap: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    backBtn: {
        padding: 8,
        backgroundColor: '#f8fafc',
        borderRadius: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
        color: '#1e293b',
    },
    subtitle: {
        fontSize: 13,
        color: '#94a3b8',
        fontWeight: '500',
    },
    downloadBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#7c3aed',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        elevation: 2,
    },
    downloadBtnText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '800',
    },
    dateSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    dateNavBtn: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: '#f0fdf4',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dateDisplay: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    dateText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#334155',
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    loadingText: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '500',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 60,
    },
    emptyIconBox: {
        width: 80,
        height: 80,
        borderRadius: 24,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1e293b',
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#94a3b8',
        textAlign: 'center',
        marginTop: 8,
        paddingHorizontal: 40,
        lineHeight: 20,
    },
    topicCard: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    periodRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    periodBadge: {
        backgroundColor: '#fdf4ff',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    periodText: {
        fontSize: 11,
        fontWeight: '900',
        color: '#a855f7',
    },
    className: {
        fontSize: 15,
        fontWeight: '800',
        color: '#1e293b',
    },
    subjectBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0fdf4',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        gap: 6,
    },
    subjectText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#10b981',
    },
    topicWell: {
        backgroundColor: '#f8fafc',
        borderRadius: 18,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    topicLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: '#94a3b8',
        letterSpacing: 1,
        marginBottom: 8,
    },
    topicText: {
        fontSize: 14,
        color: '#334155',
        lineHeight: 22,
        fontWeight: '600',
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statValue: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748b',
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    expansionContent: {
        marginTop: 20,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    tabsContainer: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 20,
    },
    tabBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: '#f8fafc',
    },
    activeTabBtn: {
        backgroundColor: '#f5f3ff',
    },
    tabBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748b',
    },
    activeTabBtnText: {
        color: '#6366f1',
    },
    formContainer: {
        backgroundColor: '#f8fafc',
        borderRadius: 20,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    materialInput: {
        minHeight: 100,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 15,
        fontSize: 14,
        color: '#1e293b',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        textAlignVertical: 'top',
    },
    previewContainer: {
        marginTop: 15,
        position: 'relative',
        width: 100,
        height: 100,
    },
    imagePreview: {
        width: 100,
        height: 100,
        borderRadius: 12,
    },
    removeImgBtn: {
        position: 'absolute',
        top: -8,
        right: -8,
        backgroundColor: '#ef4444',
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
    },
    formActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 15,
    },
    addImageBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: '#f1f5f9',
        borderRadius: 10,
    },
    addImageText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#10b981',
    },
    pdfPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fef2f2',
        padding: 10,
        borderRadius: 12,
        marginTop: 15,
        gap: 10,
        borderWidth: 1,
        borderColor: '#fee2e2',
    },
    pdfName: {
        flex: 1,
        fontSize: 13,
        fontWeight: '600',
        color: '#b91c1c',
    },
    pdfItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        padding: 12,
        borderRadius: 12,
        marginTop: 10,
        gap: 10,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    pdfItemText: {
        flex: 1,
        fontSize: 13,
        fontWeight: '600',
        color: '#334155',
    },
    postBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#f97316',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 14,
        elevation: 2,
    },
    disabledBtn: {
        backgroundColor: '#cbd5e1',
        elevation: 0,
    },
    postBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '800',
    },
    matsList: {
        gap: 12,
    },
    matItem: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 15,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    matHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 10,
    },
    matText: {
        flex: 1,
        fontSize: 14,
        color: '#334155',
        fontWeight: '600',
        lineHeight: 20,
    },
    matImage: {
        width: '100%',
        height: 200,
        marginTop: 12,
        borderRadius: 12,
        backgroundColor: '#f8fafc',
    },
    emptyMatsText: {
        textAlign: 'center',
        fontSize: 13,
        color: '#94a3b8',
        fontStyle: 'italic',
        paddingVertical: 10,
    }
});

export default MyTopics;
